import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../store";
import { db } from "../firebase";
import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
  orderBy,
  addDoc,
  updateDoc,
  getDoc,
  deleteField,
  limitToLast,
  increment,
} from "firebase/firestore";
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Send,
  Smile,
  X,
  Check,
  ArrowRight,
  Trash,
  Sparkles,
  Paperclip,
  FileText,
  Clock,
  Mic,
  MessageSquare,
  UserX,
  AlertTriangle,
} from "lucide-react";
import { emojiToSVG } from "../utils";
import { showSystemNotification } from "../services/notificationService";
import { CallScreen } from "./CallScreen";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "../hooks/useTranslation";

export function ChatView({
  contact,
  onBack,
  onForward,
}: {
  contact: any;
  onBack: () => void;
  onForward: (msg: any) => void;
}) {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [chatId, setChatId] = useState<string>("");
  const [contactTyping, setContactTyping] = useState(false);
  const [contactProfile, setContactProfile] = useState<any>(contact);
  const [activeCall, setActiveCall] = useState<{
    id: string;
    type: "voice" | "video";
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [messageMenu, setMessageMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledTime, setScheduledTime] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);

  const [showImageModal, setShowImageModal] = useState<string | null>(null);
  const [showContactInfo, setShowContactInfo] = useState(contact?.openInfoOnLoad || false);
  
  useEffect(() => {
    if (contact?.openInfoOnLoad) {
      setShowContactInfo(true);
    }
  }, [contact?.openInfoOnLoad]);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    senderId: string;
    timestamp: any;
  } | null>(null);

  const isOfficialAccount =
    contact.id === "linkup_official" || contact.uid === "linkup_official" || contactProfile?.id === "linkup_official" || contactProfile?.uid === "linkup_official" || contact.official || contact.isOfficial || contactProfile?.official || contactProfile?.isOfficial;
  const isAdmin = user?.email === "linkupply207@gmail.com";
  const canSend = !isOfficialAccount || isAdmin;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const lastTypingUpdateRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<any>(null);

  const handleBlockContact = async () => {
    if (!user || !contactProfile) return;
    try {
      const { arrayUnion, doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "users", user.uid), {
        blockedUsers: arrayUnion(contactProfile.id)
      });
      showSystemNotification("Contact Blocked", `${contactProfile.name} has been blocked.`);
      setShowContactInfo(false);
      onBack(); // Go back to chats list since we blocked them
    } catch(e) {
      console.error(e);
    }
  };

  const isBlockedByMe = profile?.blockedUsers?.includes(contactProfile.id);
  const amIBlockedByThem = contactProfile?.blockedUsers?.includes(user?.uid);
  const isBlocked = isBlockedByMe || amIBlockedByThem;

  useEffect(() => {
    if (!contact?.id) return;
    localStorage.setItem("active_chat_with", contact.id);
    (window as any).activeChatWith = contact.id;
    return () => {
      localStorage.removeItem("active_chat_with");
      (window as any).activeChatWith = null;
    };
  }, [contact?.id]);

  useEffect(() => {
    if (!user || !contact) return;

    // Official Broadcast Logic: Everyone shares the same chat ID for official announcements
    const id =
      contact.id === "linkup_official"
        ? "official_broadcast"
        : [user.uid, contact.id].sort().join("_");
    setChatId(id);

    const chatRef = doc(db, "chats", id);

    // Optimized: Only create chat document if it doesn't exist to save writes
    getDoc(chatRef).then((snap) => {
      if (!snap.exists()) {
        setDoc(chatRef, {
          participants: [user.uid, contact.id],
          createdAt: serverTimestamp(),
          unread: {},
        }).catch(console.error);
      } else {
        updateDoc(chatRef, { [`unread.${user.uid}`]: deleteField() }).catch(
          (e) => {},
        );
      }
    });

    const q = query(
      collection(db, "chats", id, "messages"),
      orderBy("timestamp", "asc"),
      limitToLast(500),
    );
    const unsubMessages = onSnapshot(
      q,
      (snap) => {
        const msgs = snap.docs.map((d) => {
          const data = d.data();
          // Handle null timestamp for optimistic updates
          return {
            id: d.id,
            ...data,
            timestamp: data.timestamp || { toDate: () => new Date() },
          };
        });
        setMessages(msgs);
        setTimeout(
          () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
          100,
        );
      },
      (err) => {
        console.error("Messages listener error:", err);
      },
    );

    // Real-time contact profile listener for online/typing status
    const unsubContactProfile = onSnapshot(
      doc(db, "users", contact.id),
      (snap) => {
        if (snap.exists()) {
          setContactProfile({ id: snap.id, ...snap.data() });
        }
      },
      (err) => console.error("Contact profile listener error:", err),
    );

    const unsubTyping = onSnapshot(
      chatRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const typingData = data.typing || {};
          const isTyping = typingData[contact.id];

          // Check if typing timestamp is recent (within 5 seconds)
          if (isTyping && isTyping.toDate) {
            const now = new Date().getTime();
            const typingTime = isTyping.toDate().getTime();
            setContactTyping(now - typingTime < 5000);
          } else {
            setContactTyping(false);
          }
        }
      },
      (err) => console.error("Typing listener error:", err),
    );

    // Mark messages as read
    const markAsRead = async () => {
      if (!user || !chatId) return;
      const unreadMessages = messages.filter(
        (m) => m.senderId !== user.uid && m.status !== "read",
      );
      if (unreadMessages.length > 0) {
        updateDoc(doc(db, "chats", chatId), {
          [`unread.${user.uid}`]: deleteField(),
        }).catch((e) => {});
      }
      for (const msg of unreadMessages) {
        await updateDoc(doc(db, "chats", chatId, "messages", msg.id), {
          status: "read",
          read: true, // Keep legacy for backward compatibility
        });
      }
    };
    markAsRead();

    return () => {
      unsubMessages();
      unsubContactProfile();
      unsubTyping();
    };
  }, [user, contact.id]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachment(file);
          // Store base64 preview for instant feedback
          (file as any).preview = reader.result;
        };
        reader.readAsDataURL(file);
      } else {
        setAttachment(file);
      }
    }
  };

  const startRecording = async () => {
    try {
      // Request permission explicitly
      if (window.hasOwnProperty("Capacitor")) {
        const { requestMediaPermissions } =
          await import("../services/notificationService");
        await requestMediaPermissions("voice");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());

        // Automatically trigger send for voice notes if we were recording
        handleSend(undefined, blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Error starting recording:", err);
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        alert("Please allow microphone access to send voice notes.");
      } else {
        alert("Could not access microphone. Please check your settings.");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSend = async (e?: React.FormEvent, overrideAudioBlob?: Blob) => {
    e?.preventDefault();
    const currentAudioBlob = overrideAudioBlob || audioBlob;
    if ((!text.trim() && !attachment && !currentAudioBlob) || !user || !chatId)
      return;

    const msgText = text.trim();
    const replyData = replyingTo
      ? {
          id: replyingTo.id,
          text: replyingTo.text,
          senderName: replyingTo.senderId === user.uid ? "You" : contact.name,
        }
      : null;

    const audioToUpload = currentAudioBlob;

    setText("");
    setReplyingTo(null);
    setAttachment(null);
    setAudioBlob(null);
    setShowSchedule(false);

    // Update lastSeen and lastChanged on every message sent
    try {
      await updateDoc(doc(db, "users", user.uid), {
        lastSeen: serverTimestamp(),
        lastChanged: serverTimestamp(),
        isOnline: true,
      });
    } catch (e) {
      console.error("Error updating presence on send:", e);
    }

    // Reset textarea height
    const textarea = document.querySelector("textarea");
    if (textarea) textarea.style.height = "auto";

    try {
      clearTimeout(typingTimeoutRef.current);

      const msgData: any = {
        senderId: user.uid,
        text: msgText,
        timestamp: serverTimestamp(),
        replyTo: replyData,
        reactions: {},
        status: "sent",
      };

      const sendPushNotification = async () => {
        const targetTokens = contactProfile?.pushTokens?.length
          ? contactProfile.pushTokens
          : contactProfile?.pushToken
            ? [contactProfile.pushToken]
            : [];
        if (targetTokens.length > 0) {
          try {
            await fetch("/api/notify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tokens: targetTokens,
                title: user.displayName || profile?.name || "LinkUpply",
                body:
                  msgText ||
                  (attachment
                    ? "Sent a photo"
                    : audioToUpload
                      ? "Sent a voice note"
                      : "New message"),
                image: profile?.photoURL || user.photoURL || undefined,
                data: { chatId, senderId: user.uid },
              }),
            });
          } catch (e) {
            console.error("Error sending push notification via API:", e);
          }
        }
      };

      if (attachment) {
        if (attachment.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            msgData.fileUrl = reader.result as string;
            msgData.fileName = attachment.name;
            msgData.fileType = attachment.type;
            await addDoc(collection(db, "chats", chatId, "messages"), msgData);
            sendPushNotification();
          };
          reader.readAsDataURL(attachment);
        } else {
          msgData.fileUrl = URL.createObjectURL(attachment);
          msgData.fileName = attachment.name;
          msgData.fileType = attachment.type;
          await addDoc(collection(db, "chats", chatId, "messages"), msgData);
          sendPushNotification();
        }
      } else if (audioToUpload) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          msgData.audioUrl = reader.result as string;
          msgData.isVoiceNote = true;
          await addDoc(collection(db, "chats", chatId, "messages"), msgData);
          sendPushNotification();
        };
        reader.readAsDataURL(audioToUpload);
      } else {
        await addDoc(collection(db, "chats", chatId, "messages"), msgData);
        sendPushNotification();
      }

      // 2. Combined update: last message + clear typing status in ONE write
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage:
          msgText || (attachment ? "Photo" : audioBlob ? "Voice Note" : ""),
        lastMessageTime: serverTimestamp(),
        lastSenderId: user.uid,
        [`unread.${contact.id}`]: increment(1),
        [`typing.${user.uid}`]: deleteField(),
      });
    } catch (err: any) {
      console.error("Error sending message:", err);
      if (err.message?.includes("quota")) {
        alert(
          "Firebase limit exceeded. Please wait for reset or upgrade plan.",
        );
      }
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    if (!user || !chatId) return;

    const now = Date.now();
    // Optimized Throttle: Only update Firestore every 10 seconds (was 3s)
    if (now - lastTypingUpdateRef.current > 10000) {
      updateDoc(doc(db, "chats", chatId), {
        [`typing.${user.uid}`]: serverTimestamp(),
      }).catch((err) => console.error("Typing update error:", err));
      lastTypingUpdateRef.current = now;
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      updateDoc(doc(db, "chats", chatId), {
        [`typing.${user.uid}`]: deleteField(),
      }).catch((err) => console.error("Typing clear error:", err));
      lastTypingUpdateRef.current = 0;
    }, 5000);
  };

  const reactToMessage = async (msgId: string, emoji: string) => {
    if (!user || !chatId) return;
    const msgRef = doc(db, "chats", chatId, "messages", msgId);
    const msg = messages.find((m) => m.id === msgId);
    const currentReactions = msg.reactions || {};
    const users = currentReactions[emoji] || [];

    let newUsers;
    if (users.includes(user.uid)) {
      newUsers = users.filter((uid: string) => uid !== user.uid);
    } else {
      newUsers = [...users, user.uid];
    }

    await updateDoc(msgRef, {
      [`reactions.${emoji}`]: newUsers.length > 0 ? newUsers : deleteField(),
    });
    setMessageMenu(null);
  };

  const deleteMessage = async (msgId: string, type: "me" | "everyone") => {
    if (!user || !chatId) return;
    try {
      const msgRef = doc(db, "chats", chatId, "messages", msgId);
      if (type === "everyone") {
        const msg = messages.find((m) => m.id === msgId);
        if (!msg) return;

        // Final check for 24h limit and ownership
        const isMe = msg.senderId === user.uid;
        const isAdmin = user.email === "linkupply207@gmail.com";

        if (isMe || isAdmin) {
          await updateDoc(msgRef, {
            text: "This message was deleted",
            deleted: true,
            fileUrl: deleteField(),
            audioUrl: deleteField(),
            isVoiceNote: deleteField(),
            fileName: deleteField(),
            fileType: deleteField(),
          });
        }
      } else {
        await updateDoc(msgRef, {
          [`hiddenFor.${user.uid}`]: true,
        });
      }
      setMessageMenu(null);
      setDeleteConfirm(null);
    } catch (err) {
      console.error(err);
    }
  };

  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessageMenu(null);
  };

  const handlePointerDown = (e: React.PointerEvent, msg: any) => {
    longPressTimerRef.current = setTimeout(() => {
      setMessageMenu({ id: msg.id, x: e.clientX, y: e.clientY });
    }, 500);
  };

  const handlePointerUp = () => {
    clearTimeout(longPressTimerRef.current);
  };

  const startCall = (type: "voice" | "video") => {
    const newCallId = doc(collection(db, "calls")).id;
    setActiveCall({ id: newCallId, type });
  };

  const isUserOnline = (contact: any) => {
    if (!contact) return false;
    if (contact.isOnline) return true;
    if (contact.lastSeen) {
      const now = new Date().getTime();
      const lastSeenTime = contact.lastSeen.toDate
        ? contact.lastSeen.toDate().getTime()
        : 0;
      return now - lastSeenTime < 60000; // 1 minute
    }
    return false;
  };

  const formatLastSeen = (timestamp: any) => {
    if (!timestamp) return "Recently";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isToday) return `Today, ${timeStr}`;
    return `${date.toLocaleDateString([], { weekday: "short" })}, ${timeStr}`;
  };

  return (
    <motion.div
      id="active-chat-container"
      data-chat-with={contact.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col h-full w-full relative text-gray-900 overflow-hidden"
    >
      {activeCall && (
        <CallScreen
          contact={contact}
          type={activeCall.type}
          isIncoming={false}
          callId={activeCall.id}
          onEnd={() => setActiveCall(null)}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between p-3 md:p-6 bg-white/90 backdrop-blur-md z-20 border-b border-gray-100 sticky top-0">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <button
            onClick={onBack}
            className="md:hidden text-gray-500 hover:text-gray-900 p-2 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0 cursor-pointer" onClick={() => setShowContactInfo(true)}>
            <div className="relative group shrink-0">
              <img
                src={contactProfile.photoURL || emojiToSVG(contactProfile.emoji)}
                alt={contactProfile.name}
                className="w-10 h-10 md:w-12 md:h-12 rounded-2xl shadow-2xl border-2 border-gray-200 group-hover:border-primary/50 transition-colors object-cover"
              />
              <div
                className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 md:w-4 md:h-4 rounded-full border-2 border-white shadow-lg ${isUserOnline(contactProfile) ? "bg-green-500" : "bg-gray-600"}`}
              ></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-semibold text-gray-900 text-[15px] tracking-tight truncate max-w-35 md:max-w-none">
                  {contactProfile.name}
                </h2>
                {isOfficialAccount && (
                  <div className="bg-blue-500 p-0.5 rounded-full shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.2)] flex items-center justify-center">
                    <Check size={8} className="text-white" strokeWidth={3} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {isOfficialAccount ? (
                  <span className="font-inter text-[13px] text-gray-500 truncate flex-1 font-light tracking-wide">
                    {contactProfile.bio || "Official LinkUpply Announcements"}
                  </span>
                ) : contactTyping ? (
                  <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="text-[10px] md:text-xs font-bold text-primary uppercase tracking-widest"
                  >
                    Typing...
                  </motion.span>
                ) : (
                  <span
                    className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest md:tracking-[0.2em] truncate ${isUserOnline(contactProfile) ? "text-primary" : "text-gray-400"}`}
                  >
                    {isUserOnline(contactProfile)
                      ? t("Online")
                      : formatLastSeen(contactProfile.lastChanged)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        {!isOfficialAccount && (
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => startCall("voice")}
              className="p-3 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-2xl transition-all"
            >
              <Phone size={22} />
            </button>
            <button
              onClick={() => startCall("video")}
              className="p-3 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-2xl transition-all"
            >
              <Video size={22} />
            </button>
            <button className="p-3 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-2xl transition-all">
              <MoreVertical size={22} />
            </button>
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative overscroll-contain">
        <div className="absolute inset-0 bg-linear-to-b from-[#0f172a]/20 to-transparent pointer-events-none"></div>
        {messages
          .filter((m) => !m.hiddenFor?.[user?.uid || ""])
          .map((msg, i) => {
            const isMe = msg.senderId === user?.uid;
            const hasReactions =
              msg.reactions && Object.keys(msg.reactions).length > 0;

            return (
              <div
                key={msg.id || i}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"} group relative`}
              >
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`max-w-[85%] md:max-w-[70%] relative ${msg.deleted ? "opacity-50 italic" : ""}`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMessageMenu({ id: msg.id, x: e.clientX, y: e.clientY });
                  }}
                  onPointerDown={(e) => handlePointerDown(e, msg)}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                >
                  <div
                    className={`p-3 md:p-4 px-5 md:px-6 rounded-[1.75rem] shadow-sm relative transition-all duration-300 ${
                      isMe
                        ? "bg-primary text-white rounded-br-sm md:rounded-br-sm"
                        : "bg-white text-gray-900 border border-gray-200 rounded-bl-sm md:rounded-bl-sm"
                    }`}
                  >
                    {msg.replyTo && (
                      <div
                        className={`mb-2 md:mb-3 p-2 md:p-3 rounded-xl md:rounded-2xl text-[11px] md:text-xs border-l-4 ${isMe ? "bg-gray-100 border-gray-200" : "bg-gray-50 border-primary/40"}`}
                      >
                        <p className="font-bold opacity-80 mb-0.5 md:mb-1">
                          {msg.replyTo.senderName}
                        </p>
                        <p className="truncate opacity-60 font-medium">
                          {msg.replyTo.text}
                        </p>
                      </div>
                    )}

                    {msg.fileUrl && msg.fileType?.startsWith("image/") && (
                      <div
                        className="mb-2 md:mb-3 rounded-xl md:rounded-2xl overflow-hidden cursor-pointer"
                        onClick={() => setShowImageModal(msg.fileUrl)}
                      >
                        <img
                          src={msg.fileUrl}
                          alt="Sent"
                          className="w-full max-h-62.5 md:max-h-75 object-cover"
                        />
                      </div>
                    )}

                    {msg.fileUrl && !msg.fileType?.startsWith("image/") && (
                      <div className="mb-2 md:mb-3 p-2 md:p-3 bg-gray-100 rounded-xl md:rounded-2xl flex items-center gap-2 md:gap-3">
                        <FileText size={18} className="text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] md:text-xs font-bold truncate">
                            {msg.fileName}
                          </p>
                        </div>
                      </div>
                    )}

                    <p className="text-[14px] md:text-[15px] leading-relaxed font-medium whitespace-pre-wrap wrap-break-word">
                      {msg.text}
                    </p>

                    {msg.audioUrl && (
                      <div className="mt-2 flex items-center gap-2 md:gap-3 bg-gray-100 p-2 md:p-3 rounded-xl md:rounded-2xl">
                        <button
                          onClick={() => {
                            const audio = new Audio(msg.audioUrl);
                            audio.play();
                          }}
                          className="w-8 h-8 md:w-10 md:h-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                        >
                          <Mic size={16} />
                        </button>
                        <div className="flex-1 h-1 bg-gray-500 rounded-full overflow-hidden">
                          <div className="w-1/3 h-full bg-primary shadow-[0_0_10px_rgba(34,211,238,0.5)]"></div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-1.5 mt-1.5">
                      <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        {msg.timestamp?.toDate
                          ? new Date(msg.timestamp.toDate()).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" },
                            )
                          : ""}
                      </p>
                      {isMe && (
                        <div className="flex items-center">
                          <Check
                            size={12}
                            className={
                              msg.status === "read"
                                ? "text-primary"
                                : "text-gray-400"
                            }
                            strokeWidth={3}
                          />
                          {(msg.status === "delivered" ||
                            msg.status === "read") && (
                            <Check
                              size={12}
                              className={`-ml-2 ${msg.status === "read" ? "text-primary" : "text-gray-400"}`}
                              strokeWidth={3}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Reactions Display */}
                    {hasReactions && (
                      <div
                        className={`absolute -bottom-4 ${isMe ? "right-4" : "left-4"} flex gap-1.5 bg-white border border-gray-200 rounded-full px-2.5 py-1 shadow-sm z-10`}
                      >
                        {Object.entries(msg.reactions).map(
                          ([emoji, uids]: [string, any]) => (
                            <span
                              key={emoji}
                              className="text-xs flex items-center gap-1"
                            >
                              {emoji}{" "}
                              <span className="opacity-60 font-bold">
                                {uids.length > 1 ? uids.length : ""}
                              </span>
                            </span>
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quick Actions on Hover */}
                  {!msg.deleted && (
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 ${isMe ? "-left-12" : "-right-12"} opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col gap-2`}
                    >
                      <button
                        onClick={() => setReplyingTo(msg)}
                        className="p-2.5 bg-white border border-gray-100 shadow-sm rounded-full text-gray-500 hover:text-primary hover:scale-110 transition-all"
                      >
                        <Smile size={16} />
                      </button>
                    </div>
                  )}
                </motion.div>
              </div>
            );
          })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Context Menu */}
      <AnimatePresence>
        {messageMenu && (
          <>
            <div
              className="fixed inset-0 z-60"
              onClick={() => setMessageMenu(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              style={{
                top: Math.min(messageMenu.y, window.innerHeight - 250),
                left: Math.min(messageMenu.x, window.innerWidth - 200),
              }}
              className="fixed z-70 bg-white shadow-2xl rounded-4xl p-3 min-w-45 border border-gray-100"
            >
              <div className="flex justify-around p-3 border-b border-gray-200 mb-3">
                {["❤️", "👍", "😂", "😮", "😢", "🙏"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => reactToMessage(messageMenu.id, emoji)}
                    className="hover:scale-150 transition-transform text-xl duration-300"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setReplyingTo(
                      messages.find((m) => m.id === messageMenu.id),
                    );
                    setMessageMenu(null);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-100 rounded-2xl text-sm font-bold transition-colors flex items-center gap-3"
                >
                  <ArrowLeft size={16} className="rotate-180 text-primary" />{" "}
                  Reply
                </button>
                <button
                  onClick={() => {
                    onForward(messages.find((m) => m.id === messageMenu.id));
                    setMessageMenu(null);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-100 rounded-2xl text-sm font-bold transition-colors flex items-center gap-3"
                >
                  <ArrowRight size={16} className="text-primary" /> Forward
                </button>
                <button
                  onClick={() =>
                    copyMessage(
                      messages.find((m) => m.id === messageMenu.id)?.text,
                    )
                  }
                  className="w-full text-left px-4 py-3 hover:bg-gray-100 rounded-2xl text-sm font-bold transition-colors flex items-center gap-3"
                >
                  <Sparkles size={16} className="text-primary" /> Copy
                </button>
                <button
                  onClick={() => {
                    const msg = messages.find((m) => m.id === messageMenu.id);
                    setDeleteConfirm({
                      id: messageMenu.id,
                      senderId: msg.senderId,
                      timestamp: msg.timestamp,
                    });
                    setMessageMenu(null);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-red-400/10 rounded-2xl text-sm font-bold text-red-400 transition-colors flex items-center gap-3"
                >
                  <Trash size={16} /> Delete
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Sub-menu */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/60 backdrop-blur-sm"
              onClick={() => setDeleteConfirm(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-xs bg-white rounded-[2.5rem] p-6 border border-gray-200 shadow-2xl"
            >
              <h3 className="text-lg font-bold mb-6 text-center">
                Delete Message?
              </h3>
              <div className="space-y-3">
                {(deleteConfirm.senderId === user?.uid ||
                  user?.email === "linkupply207@gmail.com") && (
                  <button
                    onClick={() => deleteMessage(deleteConfirm.id, "everyone")}
                    className="w-full py-4 bg-red-500 text-gray-900 font-bold rounded-2xl shadow-lg shadow-red-500/20 hover:brightness-110 transition"
                  >
                    Delete for everyone
                  </button>
                )}
                <button
                  onClick={() => deleteMessage(deleteConfirm.id, "me")}
                  className="w-full py-4 bg-gray-50 text-gray-900 font-bold rounded-2xl border border-gray-200 hover:bg-gray-100 transition"
                >
                  Delete for me
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="w-full py-4 text-gray-400 font-bold hover:text-gray-900 transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {showImageModal && (
          <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/90 backdrop-blur-xl"
              onClick={() => setShowImageModal(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full h-full flex items-center justify-center"
            >
              <img
                src={showImageModal}
                alt="Preview"
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              />
              <button
                onClick={() => setShowImageModal(null)}
                className="absolute top-4 right-4 p-3 bg-gray-100 hover:bg-gray-500 rounded-full text-gray-900 transition-colors"
              >
                <X size={32} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Composer */}
      <div className="p-4 md:p-6 bg-white/90 backdrop-blur-md border-t border-gray-100 z-20 rounded-t-none md:rounded-t-[3rem]">
        {!canSend ? (
          <div className="p-4 bg-gray-50 rounded-4xl border border-gray-200 text-center">
            <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-xs">
              Only LinkUpply can send messages
            </p>
          </div>
        ) : (
          <>
            <AnimatePresence>
              {attachment && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-gray-50 rounded-2xl border border-gray-200 p-4 flex items-center justify-between mb-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center shadow-lg">
                      <FileText size={24} className="text-primary" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {attachment.name}
                      </p>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                        {(attachment.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAttachment(null)}
                    className="text-gray-400 hover:text-gray-900 p-2 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <X size={20} />
                  </button>
                </motion.div>
              )}
              {replyingTo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-gray-50 rounded-2xl border border-gray-200 p-4 flex items-center justify-between mb-4"
                >
                  <div className="border-l-4 border-primary pl-4 overflow-hidden">
                    <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
                      {replyingTo.senderId === user?.uid ? "You" : contact.name}
                    </p>
                    <p className="text-sm text-gray-500 truncate font-medium">
                      {replyingTo.text}
                    </p>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="text-gray-400 hover:text-gray-900 p-2 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <X size={20} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {isBlocked ? (
              <div className="flex justify-center items-center p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                <span className="text-gray-500 font-medium">You cannot send messages to this contact.</span>
              </div>
            ) : canSend ? (
            <form onSubmit={handleSend} className="flex flex-col gap-4">
              {showSchedule && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200">
                  <Clock size={18} className="text-primary" />
                  <input
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="bg-transparent text-sm text-gray-900 outline-none flex-1 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSchedule(false)}
                    className="text-gray-400 hover:text-gray-900"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-4xl border border-gray-200 mb-4 max-h-50 overflow-y-auto custom-scrollbar"
                  >
                    {[
                      "😀",
                      "😂",
                      "😍",
                      "😎",
                      "🔥",
                      "✨",
                      "👍",
                      "❤️",
                      "🙏",
                      "🚀",
                      "🌈",
                      "🍕",
                      "🎸",
                      "🎮",
                      "💡",
                      "💯",
                      "👏",
                      "🙌",
                      "🎉",
                      "🎁",
                      "🎂",
                      "🍦",
                      "🍔",
                      "🍟",
                      "🍕",
                      "🍺",
                      "🍷",
                      "🍸",
                      "🍹",
                      "☕",
                      "🍵",
                    ].map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => {
                          setText((prev) => prev + e);
                          setShowEmojiPicker(false);
                        }}
                        className="text-3xl hover:scale-150 transition-transform p-2.5 duration-300"
                      >
                        {e}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex items-center gap-1 bg-gray-50 rounded-full p-1 border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`p-3 rounded-full transition-all ${showEmojiPicker ? "bg-primary text-white" : "text-gray-400 hover:text-gray-900 hover:bg-gray-50"}`}
                  >
                    <Smile size={24} />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-full transition-all"
                  >
                    <Paperclip size={24} className="rotate-45" />
                  </button>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="flex-1 relative group">
                  <textarea
                    autoFocus
                    rows={1}
                    value={text}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    dir="ltr"
                    style={{
                      direction: "ltr",
                      textAlign: "left",
                      maxHeight: "150px",
                      overflowY: "auto",
                    }}
                    onChange={(e) => {
                      handleTyping(e as any);
                      e.target.style.height = "auto";
                      e.target.style.height =
                        Math.min(e.target.scrollHeight, 150) + "px";
                    }}
                    placeholder={
                      isRecording ? t("Recording Audio...") : t("Type a message...")
                    }
                    className={`w-full bg-gray-50 border border-gray-200 rounded-3xl px-4 md:px-6 py-3 md:py-4 text-gray-900 focus:border-primary/50 outline-none text-sm md:text-base font-medium transition-all placeholder:text-gray-400 resize-none custom-scrollbar wrap-break-word ${isRecording ? "border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]" : ""}`}
                  />
                  {isRecording && (
                    <motion.div
                      animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 w-2.5 h-2.5 md:w-3 md:h-3 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {text.trim() || attachment || audioBlob ? (
                    <motion.button
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.9 }}
                      type="submit"
                      className="bg-primary text-white p-4 rounded-full shadow-2xl shadow-primary/30"
                    >
                      <Send size={24} strokeWidth={2.5} />
                    </motion.button>
                  ) : (
                    <motion.button
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onMouseLeave={stopRecording}
                      onTouchStart={startRecording}
                      onTouchEnd={stopRecording}
                      className={`p-4 rounded-full transition-all ${isRecording ? "bg-red-500 text-gray-900 shadow-[0_0_20px_rgba(239,68,68,0.4)]" : "bg-gray-50 text-gray-400 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"}`}
                    >
                      <Mic size={24} />
                    </motion.button>
                  )}
                </div>
              </div>
            </form>
            ) : null}
          </>
        )}
      </div>
      <AnimatePresence>
        {showContactInfo && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-0 z-100 bg-[#f8fafc] flex flex-col overflow-y-auto custom-scrollbar"
          >
            <div className="sticky top-0 bg-[#f8fafc]/80 backdrop-blur-xl z-20 flex items-center px-4 py-4 gap-4 border-b border-gray-100">
              <button
                onClick={() => setShowContactInfo(false)}
                className="p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
                title="Go back"
              >
                <ArrowLeft size={24} />
              </button>
              <h2 className="text-xl font-medium text-gray-900 tracking-tight flex-1">{t("Contact Info")}</h2>
              <button className="p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors">
                <MoreVertical size={20} />
              </button>
            </div>

            <div className="flex flex-col items-center pt-8 pb-6 px-4">
              <div 
                className="relative group cursor-pointer mb-5 block transition-transform hover:scale-105"
                onClick={() => setShowImageModal(contactProfile.photoURL || emojiToSVG(contactProfile.emoji))}
              >
                <img
                  src={contactProfile.photoURL || emojiToSVG(contactProfile.emoji)}
                  alt={contactProfile.name}
                  className="w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] shadow-2xl border-4 border-gray-200 object-cover"
                />
                <div
                  className={`absolute -bottom-2 -right-2 w-6 h-6 rounded-full border-4 border-white shadow-lg ${isUserOnline(contactProfile) ? "bg-green-500" : "bg-gray-600"}`}
                ></div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{contactProfile.name}</h1>
                {isOfficialAccount && (
                  <div className="bg-blue-500 p-1 rounded-full shrink-0 shadow-[0_0_12px_rgba(59,130,246,0.3)] flex items-center justify-center">
                    <Check size={14} className="text-white" strokeWidth={4} />
                  </div>
                )}
              </div>
              <p className="text-gray-500 text-lg mb-3">{contactProfile.linkupId}</p>
              
              <div className="text-sm font-medium text-gray-400 mb-8">
                {isUserOnline(contactProfile) ? (
                   <span className="text-primary font-bold">{t("Online")}</span>
                ) : (
                   `Last seen ${formatLastSeen(contactProfile.lastChanged)}`
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4 w-full max-w-sm px-2">
                <button 
                  onClick={() => setShowContactInfo(false)}
                  className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-3xl py-4 flex flex-col items-center gap-2 transition-all"
                >
                  <MessageSquare size={24} className="text-gray-700" />
                  <span className="text-gray-900 font-medium text-sm">Message</span>
                </button>
                <button 
                  onClick={() => { setShowContactInfo(false); startCall("voice"); }}
                  className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-3xl py-4 flex flex-col items-center gap-2 transition-all"
                >
                  <Phone size={24} className="text-gray-700" />
                  <span className="text-gray-900 font-medium text-sm">Audio</span>
                </button>
                <button 
                  onClick={() => { setShowContactInfo(false); startCall("video"); }}
                  className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-3xl py-4 flex flex-col items-center gap-2 transition-all"
                >
                  <Video size={24} className="text-gray-700" />
                  <span className="text-gray-900 font-medium text-sm">Video</span>
                </button>
              </div>
            </div>

            {/* Additional Info Cards */}
            <div className="px-4 pb-12 space-y-4">
              {contactProfile.bio && (
                <div className="bg-gray-50 border border-gray-100 rounded-3xl p-5">
                  <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">{t("About")}</h3>
                  <p className="text-gray-900 text-base leading-relaxed wrap-break-word">{contactProfile.bio}</p>
                </div>
              )}
              
              <div className="bg-gray-50 border border-gray-100 rounded-3xl overflow-hidden mt-6">
                 <button onClick={handleBlockContact} className="w-full flex items-center justify-between p-5 hover:bg-gray-100 transition-colors text-left text-red-500 font-medium">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500 rounded-full">
                       <UserX size={20} />
                     </div>
                     <span className="text-lg">Block {contactProfile.name}</span>
                   </div>
                 </button>
                 <div className="w-full h-px bg-gray-50"></div>
                 <button onClick={() => {
                   showSystemNotification("Report Submitted", `${contactProfile.name} has been reported.`);
                 }} className="w-full flex items-center justify-between p-5 hover:bg-gray-100 transition-colors text-left text-red-500 font-medium">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500 rounded-full">
                       <AlertTriangle size={20} />
                     </div>
                     <span className="text-lg">Report contact</span>
                   </div>
                 </button>
              </div>
            </div>
            
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
  
