import React, { useState, useEffect } from "react";
import { useAuth } from "../store";
import { auth, db } from "../firebase";
import {
  GoogleAuthProvider,
  EmailAuthProvider,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  signInWithPopup,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  query,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  deleteDoc,
  where,
  getDocs,
  updateDoc,
  addDoc,
  deleteField,
} from "firebase/firestore";
import {
  LogOut,
  UserPlus,
  MessageSquare,
  Phone,
  Bell,
  Menu,
  X,
  Search,
  ChevronRight,
  Palette,
  Sun,
  Moon,
  Sparkles,
  Check,
  Clock,
  Trash,
  MoreVertical,
  Settings as SettingsIcon,
} from "lucide-react";
import { Logo } from "./Logo";
import { emojiToSVG, getFirebaseErrorMessage } from "../utils";
import { ChatView } from "./ChatView";
import { CallScreen } from "./CallScreen";
import { Settings } from "./Settings";
import { Updates } from "./Updates";
import { CinematicIntro } from "./CinematicIntro";
import { showSystemNotification } from "../services/notificationService";
import { motion, AnimatePresence } from "motion/react";

import { useTranslation } from "../hooks/useTranslation"; // custom hook for multi-language support

export function Main() {
  const { t, lang } = useTranslation();
  const { user, profile, logout, isDeleting, setIsDeleting, isNetworkOnline } =
    useAuth();
  const [activeTab, setActiveTab] = useState<
    "home" | "requests" | "calls" | "profile" | "settings" | "updates"
  >("home");
  const [dotsMenuOpen, setDotsMenuOpen] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [incomingCall, setIncomingCall] = useState<any | null>(null);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [chatsState, setChatsState] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [forwardingMsg, setForwardingMsg] = useState<any | null>(null);

  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (
        event.data &&
        event.data.type === "OPEN_CHAT" &&
        event.data.senderId
      ) {
        const targetUserId = event.data.senderId;
        // Find contact with that ID
        const contact = contacts.find((c) => c.id === targetUserId);
        if (contact) {
          setActiveChat(contact);
        } else {
          // If contact not immediately found, try to fetch or just set it
          getDoc(doc(db, "users", targetUserId)).then((snap) => {
            if (snap.exists()) {
              setActiveChat({ id: snap.id, ...snap.data() });
            }
          });
        }
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "message",
        handleServiceWorkerMessage,
      );
    }

    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "message",
          handleServiceWorkerMessage,
        );
      }
    };
  }, [contacts]);

  useEffect(() => {
    if (!user?.uid) return;

    // Ensure Official LinkUpply account is in contacts
    const officialRef = doc(
      db,
      "users",
      user.uid,
      "contacts",
      "linkup_official",
    );
    getDoc(officialRef)
      .then((snap) => {
        if (!snap.exists()) {
          setDoc(officialRef, {
            addedAt: serverTimestamp(),
            official: true,
          }).catch((err) =>
            console.error("Official contact setup error:", err),
          );
        }
      })
      .catch((err) => console.error("Official contact check error:", err));

    // Ensure official profile exists globally
    const globalOfficialRef = doc(db, "users", "linkup_official");
    getDoc(globalOfficialRef)
      .then((snap) => {
        if (!snap.exists()) {
          setDoc(globalOfficialRef, {
            uid: "linkup_official",
            name: "Official LinkUpply",
            emoji: "🚀",
            linkupId: "linkupply",
            bio: "Official LinkUpply Announcements",
            photoURL: "/logo.png",
            isOnline: true,
            lastChanged: serverTimestamp(),
          }).catch((err) =>
            console.error("Global official profile setup error:", err),
          );
        } else {
          const data = snap.data();
          const updates: any = {};
          if (data?.photoURL !== "/logo.png") updates.photoURL = "/logo.png";
          if (data?.name !== "Official LinkUpply")
            updates.name = "Official LinkUpply";
          if (data?.bio !== "Official LinkUpply Announcements")
            updates.bio = "Official LinkUpply Announcements";

          if (Object.keys(updates).length > 0) {
            updateDoc(globalOfficialRef, updates).catch((err) =>
              console.error("Global official profile update error:", err),
            );
          }
        }
      })
      .catch((err) =>
        console.error("Global official profile check error:", err),
      );

    // Ensure official broadcast chat document exists
    const broadcastChatRef = doc(db, "chats", "official_broadcast");
    getDoc(broadcastChatRef)
      .then((snap) => {
        if (!snap.exists()) {
          setDoc(broadcastChatRef, {
            participants: ["linkup_official"],
            lastMessage: "Welcome to LinkUpply!",
            lastMessageTime: serverTimestamp(),
            createdAt: serverTimestamp(),
            official: true,
          }).catch((err) => console.error("Broadcast chat setup error:", err));
        }
      })
      .catch((err) => console.error("Broadcast chat check error:", err));

    // Listen to contacts list - Optimized
    const contactsQ = query(collection(db, "users", user.uid, "contacts"));
    const unsubContacts = onSnapshot(
      contactsQ,
      async (snap) => {
        const contactIds = snap.docs.map((d) => d.id);
        if (contactIds.length === 0) {
          setContacts([]);
          return;
        }

        try {
          // Fetch profiles in one go instead of nested listeners
          const profilesQ = query(
            collection(db, "users"),
            where("uid", "in", contactIds.slice(0, 30)),
          );
          const pSnap = await getDocs(profilesQ);
          const profiles: any[] = pSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));

          // Ensure official profile is present if not in fetched profiles
          if (!profiles.find((p) => p.id === "linkup_official")) {
            const offSnap = await getDoc(doc(db, "users", "linkup_official"));
            if (offSnap.exists()) {
              profiles.push({ id: "linkup_official", ...offSnap.data() });
            } else {
              // Create official profile if it doesn't exist globally
              await setDoc(doc(db, "users", "linkup_official"), {
                uid: "linkup_official",
                name: "Official LinkUpply",
                emoji: "🚀",
                linkupId: "linkupply",
                bio: "Official LinkUpply Announcements",
                isOnline: true,
                lastChanged: serverTimestamp(),
              });
              profiles.push({
                id: "linkup_official",
                uid: "linkup_official",
                name: "Official LinkUpply",
                emoji: "🚀",
                linkupId: "linkupply",
                bio: "Official LinkUpply Announcements",
                isOnline: true,
                lastChanged: serverTimestamp(),
              });
            }
          }

          setContacts(profiles);
        } catch (err) {
          console.error("Contacts profile fetch error:", err);
        }
      },
      (err) => console.error("Contacts listener error:", err),
    );

    // Listen to incoming requests - Optimized
    const requestsQ = query(
      collection(db, "users", user.uid, "requests"),
      where("status", "==", "pending"),
    );
    const unsubRequests = onSnapshot(
      requestsQ,
      async (snap) => {
        const requesterIds = snap.docs.map((d) => d.id);
        if (requesterIds.length === 0) {
          setRequests([]);
          return;
        }
        try {
          const profilesQ = query(
            collection(db, "users"),
            where("uid", "in", requesterIds.slice(0, 30)),
          );
          const pSnap = await getDocs(profilesQ);
          const profiles: any[] = pSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          setRequests(profiles);
        } catch (err) {
          console.error("Requests profile fetch error:", err);
        }
      },
      (err) => console.error("Requests listener error:", err),
    );

    const callsQ = query(
      collection(db, "calls"),
      where("calleeId", "==", user.uid),
      where("status", "==", "calling"),
    );
    const unsubCalls = onSnapshot(
      callsQ,
      (snap) => {
        if (!snap.empty) {
          const callDoc = snap.docs[0];
          const callerId = callDoc.data().callerId;
          getDoc(doc(db, "users", callerId)).then((callerDoc) => {
            if (callerDoc.exists()) {
              setIncomingCall({
                id: callDoc.id,
                ...callDoc.data(),
                caller: { id: callerDoc.id, ...callerDoc.data() },
              });
            }
          });
        } else {
          setIncomingCall(null);
        }
      },
      (err) => console.error("Calls listener error:", err),
    );

    let calls1: any[] = [];
    let calls2: any[] = [];
    const updateCallHistory = () => {
      const merged = [...calls1, ...calls2]
        .filter((c) => c.timestamp)
        .sort(
          (a, b) =>
            (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0),
        );
      setCallHistory(merged.slice(0, 50));
    };

    const unsubC1 = onSnapshot(
      query(collection(db, "calls"), where("callerId", "==", user.uid)),
      (snap) => {
        calls1 = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        updateCallHistory();
      },
    );
    const unsubC2 = onSnapshot(
      query(collection(db, "calls"), where("calleeId", "==", user.uid)),
      (snap) => {
        calls2 = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        updateCallHistory();
      },
    );

    // Notification listener for new messages
    const chatsQ = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
    );
    const unsubNotifications = onSnapshot(chatsQ, (snap) => {
      const currentChatsState: Record<string, any> = {};
      snap.docs.forEach((doc) => {
        currentChatsState[doc.id] = doc.data();
      });
      setChatsState(currentChatsState);

      snap.docChanges().forEach(async (change) => {
        if (change.type === "modified" || change.type === "added") {
          const data = change.doc.data();
          const lastSenderId = data.lastSenderId;
          const lastMessage = data.lastMessage;
          const lastMessageTime = data.lastMessageTime;

          // Only show if:
          // 1. Message is from someone else
          // 2. We are not currently in that chat
          // 3. The message is recent (within last 15 seconds)
          if (
            lastSenderId &&
            lastSenderId !== user.uid &&
            activeChat?.id !== lastSenderId
          ) {
            const msgTime = lastMessageTime?.toDate
              ? lastMessageTime.toDate().getTime()
              : 0;
            const now = Date.now();
            // Only trigger if it's less than 30 seconds old
            if (now - msgTime < 30000) {
              // Fetch sender info from contacts
              getDoc(doc(db, "users", lastSenderId)).then((senderDoc) => {
                if (senderDoc.exists()) {
                  const sData = senderDoc.data();
                  showSystemNotification(
                    sData.name || "New Message",
                    lastMessage,
                    sData.uid || lastSenderId,
                    sData.photoURL,
                  );
                }
              });
            }
          }
        }
      });
    });

    return () => {
      unsubContacts();
      unsubRequests();
      unsubCalls();
      unsubC1();
      unsubC2();
      unsubNotifications();
    };
  }, [user?.uid, activeChat?.id]);

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

  const filteredContacts = contacts.filter(
    (c) =>
      (!profile?.blockedUsers?.includes(c.id)) &&
      (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.linkupId.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const togglePin = async (contactId: string) => {
    if (!user) return;
    const id = [user.uid, contactId].sort().join("_");
    const chatRef = doc(db, "chats", id);
    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists()) {
      const pinnedBy = chatSnap.data().pinnedBy || [];
      const newPinnedBy = pinnedBy.includes(user.uid)
        ? pinnedBy.filter((uid: string) => uid !== user.uid)
        : [...pinnedBy, user.uid];
      await updateDoc(chatRef, { pinnedBy: newPinnedBy });
    }
  };

  const handleForward = async (targetContact: any) => {
    if (!user || !forwardingMsg) return;
    const id = [user.uid, targetContact.id].sort().join("_");

    try {
      await addDoc(collection(db, "chats", id, "messages"), {
        senderId: user.uid,
        text: forwardingMsg.text,
        timestamp: serverTimestamp(),
        forwarded: true,
      });

      await updateDoc(doc(db, "chats", id), {
        lastMessage: forwardingMsg.text,
        lastMessageTime: serverTimestamp(),
        lastSenderId: user.uid,
      });

      setForwardingMsg(null);
    } catch (err) {
      console.error(err);
    }
  };

  const totalUnread = Object.values(chatsState).reduce((acc, chat) => {
    return acc + (chat.unread?.[user?.uid || ""] || 0);
  }, 0);

  const navItems = [
    { id: "home", icon: MessageSquare, label: t("Chats") },
    { id: "updates", icon: Clock, label: t("Updates") },
    { id: "requests", icon: UserPlus, label: t("Link") },
    { id: "calls", icon: Phone, label: t("Calls") },
  ];

  return (
    <div 
      className="flex h-dvh w-full bg-transparent overflow-hidden object-contain relative"
      dir={lang === 'ur' ? 'rtl' : 'ltr'}
    >
      {/* Desktop Side Rail */}
      <nav className="hidden md:flex flex-col w-20 lg:w-22.5 border-r border-[#0f172a]/80 bg-black/40 backdrop-blur-3xl items-center py-6 z-60 shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
        <Logo className="w-10 h-10 mb-8 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]" />
        <div className="flex flex-col gap-6 w-full items-center">
          {navItems.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center relative w-14 h-14 rounded-2xl group transition-all duration-300 ${activeTab === tab.id ? "text-primary bg-primary/10" : "text-white/40 hover:text-white/90 hover:bg-white/5"}`}
            >
              <div className="relative z-10">
                {typeof tab.icon === "function" ? (
                  <tab.icon />
                ) : (
                  React.createElement(tab.icon as any, {
                    size: 24,
                    strokeWidth: activeTab === tab.id ? 2.5 : 2,
                  })
                )}
                {tab.id === "home" && totalUnread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-linear-to-br from-red-500 to-pink-500 text-white text-[10px] font-bold rounded-full min-w-4.5 h-4.5 px-1 flex items-center justify-center border-2 border-black shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </div>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="desktopActiveTabIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-primary rounded-r-full shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content Area (Sidebar + Chat) */}
      <div className="flex flex-1 h-[calc(100dvh-72px)] md:h-dvh relative overflow-hidden">
        {incomingCall && (
          <CallScreen
            contact={incomingCall.caller}
            type={incomingCall.type}
            isIncoming={true}
            callId={incomingCall.id}
            onEnd={() => setIncomingCall(null)}
          />
        )}

        {/* Forward Modal */}
        <AnimatePresence>
          {forwardingMsg && (
            <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setForwardingMsg(null)}
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-md bg-container rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              >
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                  <h2 className="text-xl font-bold">{t("Forward to...")}</h2>
                  <button
                    onClick={() => setForwardingMsg(null)}
                    className="text-gray-500 hover:text-text"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {contacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => handleForward(contact)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl transition"
                    >
                      <img
                        src={emojiToSVG(contact.emoji)}
                        alt={contact.name}
                        className="w-10 h-10 rounded-xl"
                      />
                      <div className="text-left">
                        <p className="font-bold text-text">{contact.name}</p>
                        <p className="text-xs text-gray-500">
                          {contact.linkupId}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Sidebar - Hidden on mobile when chat is active */}
        <div
          className={`
          ${activeChat ? "hidden md:flex" : "flex"} 
          flex-col w-full md:w-95 lg:w-105 border-r border-white/5 bg-transparent h-full z-10
        `}
        >
          {/* Sidebar Header */}
          <header
            className={`p-4 md:px-6 md:py-5 flex items-center justify-between bg-black/40 backdrop-blur-3xl sticky top-0 z-50 border-b border-white/5 transition-all ${activeTab === "profile" ? "justify-center border-b-transparent shadow-[0_10px_30px_rgba(0,0,0,0.5)]" : ""}`}
          >
            {activeTab === "profile" ? (
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[11px] font-bold tracking-[0.25em] uppercase text-primary/80"
              >
                {t("Your Profile")}
              </motion.h1>
            ) : (
              <>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <Logo className="w-8 h-8 md:w-9 md:h-9 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
                    <h1 className="text-xl md:text-[22px] font-bold tracking-tight text-white/90 drop-shadow-sm">
                      LinkUpply
                    </h1>
                  </div>
                  {!isNetworkOnline && (
                    <span className="text-[9px] text-red-500 font-bold uppercase tracking-[0.2em] animate-pulse mt-0.5">
                      {t("Offline")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 relative">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setActiveTab("requests")}
                    className={`p-2.5 rounded-[1.25rem] transition-all relative ${activeTab === "requests" ? "bg-primary/10 text-primary border border-primary/20 backdrop-blur-md" : "text-white/50 border border-transparent hover:text-white hover:bg-white/5"}`}
                  >
                    <Bell size={20} strokeWidth={1.5} />
                    {requests.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-linear-to-br from-red-500 to-pink-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-black shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                        {requests.length}
                      </span>
                    )}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setActiveTab("settings")}
                    className={`p-2.5 rounded-[1.25rem] transition-all relative ${activeTab === "settings" ? "bg-primary/10 text-primary border border-primary/20 backdrop-blur-md" : "text-white/50 border border-transparent hover:text-white hover:bg-white/5"}`}
                  >
                    <SettingsIcon size={20} strokeWidth={1.5} />
                  </motion.button>
                  <CinematicIntro />
                </div>
              </>
            )}
          </header>

          {/* Search Bar */}
          {activeTab === "home" && (
            <div className="p-4 md:px-6 md:py-4">
              <div className="relative group z-10">
                <Search
                  size={18}
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-primary transition-colors stroke-2"
                />
                <input
                  type="text"
                  placeholder={t("Search conversations...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/3 border border-white/10 rounded-full py-3.5 pl-12 pr-5 text-sm font-light text-white outline-none focus:border-primary/40 focus:bg-white/5 transition-all placeholder:text-white/20 backdrop-blur-xl hover:bg-white/5"
                />
              </div>
            </div>
          )}

          {/* Chat List Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar overscroll-none pb-24 md:pb-4">
            <AnimatePresence mode="wait">
              {activeTab === "home" && (
                <motion.div
                  key="home"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="p-3 md:px-4 space-y-2"
                >
                  {filteredContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                      <div className="w-16 h-16 bg-white/2 border border-white/5 rounded-3xl flex items-center justify-center text-white/20 mb-6 drop-shadow-xl backdrop-blur-md">
                        <MessageSquare size={32} strokeWidth={1.5} />
                      </div>
                      <p className="text-white/40 text-sm font-medium tracking-wide">
                        {t("No chats yet")}
                      </p>
                    </div>
                  ) : (
                    filteredContacts.map((contact, index) => (
                      <div
                        key={contact.id}
                        className="relative group/swipe touch-pan-y"
                      >
                        {/* Swipe Action Background Mock */}
                        <div className="absolute inset-0 bg-red-500/20 rounded-3xl flex flex-row-reverse items-center px-6 text-red-500 opacity-0 transition-opacity">
                          <Trash size={20} />
                        </div>

                        <motion.div
                          drag="x"
                          dragConstraints={{ left: 0, right: 0 }} // Disabled real drag for simplicity, relying on hover/tap
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setActiveChat(contact)}
                          className={`flex items-center gap-4 p-4 rounded-3xl cursor-pointer transition-all border relative overflow-hidden backdrop-blur-md glass-morphism ${
                            activeChat?.id === contact.id
                              ? "border-primary/20 bg-primary/5 shadow-[0_4px_20px_rgba(34,211,238,0.1)]"
                              : "border-white/4 bg-white/2 hover:bg-white/4 hover:border-white/8"
                          }`}
                        >
                          <div 
                            className="relative shrink-0" 
                            onClick={(e) => { e.stopPropagation(); setActiveChat({ ...contact, openInfoOnLoad: true }); }}
                          >
                            <img
                              src={
                                contact.photoURL || emojiToSVG(contact.emoji)
                              }
                              alt={contact.name}
                              className={`w-14 h-14 rounded-full object-cover ${contact.isOfficial ? "border-2 border-primary shadow-[0_0_15px_rgba(34,211,238,0.5)]" : "border border-white/10 shadow-lg"}`}
                            />
                            {isUserOnline(contact) && (
                              <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-[2.5px] border-black shadow-[0_0_10px_rgba(34,197,94,0.6)]"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline">
                              <h3 className="font-semibold text-white truncate flex items-center gap-1.5 text-[15px] tracking-tight">
                                {contact.name}
                                {contact.isOfficial && (
                                  <div className="bg-blue-500 p-0.5 rounded-full shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]">
                                    <Check
                                      size={8}
                                      className="text-white"
                                      strokeWidth={5}
                                    />
                                  </div>
                                )}
                              </h3>
                              <span
                                className={`text-[10px] font-medium ${chatsState[contact.id === "linkup_official" ? "official_broadcast" : [user?.uid, contact.id].sort().join("_")]?.unread?.[user?.uid || ""] > 0 ? "text-primary" : "text-white/40"}`}
                              >
                                12:45 PM
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <p className="font-inter text-[13px] text-white/50 truncate flex-1 font-light tracking-wide">
                                {contact.bio || "Hey there! Let's hook up."}
                              </p>
                              <div className="flex items-center gap-2 pl-3">
                                {(() => {
                                  const contactChatId =
                                    contact.id === "linkup_official"
                                      ? "official_broadcast"
                                      : [user?.uid, contact.id]
                                          .sort()
                                          .join("_");
                                  const unreadCount =
                                    chatsState[contactChatId]?.unread?.[
                                      user?.uid || ""
                                    ] || 0;
                                  return unreadCount > 0 ? (
                                    <div className="min-w-5 h-5 px-1.5 rounded-full bg-linear-to-tr from-secondary to-primary flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.4)]">
                                      <span className="text-[10px] font-bold text-[#0f172a]">
                                        {unreadCount}
                                      </span>
                                    </div>
                                  ) : null;
                                })()}
                                {/* Pin Indicator */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePin(contact.id);
                                  }}
                                  className="opacity-0 group-hover/swipe:opacity-100 transition-opacity p-1 text-white/30 hover:text-primary scale-90"
                                >
                                  <Sparkles size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === "requests" && (
                <motion.div
                  key="requests"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="p-3 md:px-4"
                >
                  <RequestsView
                    requests={requests}
                    contacts={contacts}
                    onOpenChat={(contact) => {
                      setActiveChat(contact);
                      setActiveTab("home");
                    }}
                  />
                </motion.div>
              )}

              {activeTab === "calls" && (
                <motion.div
                  key="calls"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="h-full flex flex-col pt-4"
                  dir={lang === 'ur' ? 'rtl' : 'ltr'}
                >
                  <div className="px-5 mb-4 flex justify-between items-center">
                    <h2 className="text-[11px] font-bold text-white/50 uppercase tracking-[0.2em]">
                      {t("Recent Calls")}
                    </h2>
                  </div>

                  <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-24">
                    {callHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 opacity-60">
                        <div className="w-24 h-24 mb-6 rounded-4xl bg-black/40 border border-white/10 shadow-2xl flex items-center justify-center relative overflow-hidden backdrop-blur-3xl">
                          <div className="absolute inset-0 bg-primary/10 blur-xl"></div>
                          <Phone
                            size={40}
                            className="text-white/50 relative z-10"
                            strokeWidth={1}
                          />
                        </div>
                        <p className="text-sm text-white/40 font-medium">
                          {t("No recent calls")}
                        </p>
                      </div>
                    ) : (
                      callHistory.map((call) => {
                        const isIncoming = call.calleeId === user?.uid;
                        const otherUserUID = isIncoming
                          ? call.callerId
                          : call.calleeId;
                        const otherUser = contacts.find(
                          (c) => c.uid === otherUserUID,
                        ) || { name: "Unknown", photoURL: null, emoji: "👤" };
                        const isMissed =
                          isIncoming && call.status === "ended" && !call.answer; // Assuming no answer means missed

                        return (
                          <div
                            key={call.id}
                            className="flex items-center gap-4 p-4 rounded-3xl bg-white/2 border border-white/5 backdrop-blur-md"
                          >
                            <div
                              className={`w-12 h-12 rounded-full border flex items-center justify-center ${isMissed ? "border-red-500/20 bg-red-500/5" : "border-white/10 bg-white/5"}`}
                            >
                              <Phone
                                className={
                                  isMissed
                                    ? "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                                    : "text-white/70"
                                }
                                size={20}
                                strokeWidth={2}
                              />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-white font-semibold flex items-center gap-2">
                                {otherUser.name}
                              </h4>
                              <p
                                className={
                                  isMissed
                                    ? "text-red-400 text-xs font-medium flex items-center gap-1 mt-0.5"
                                    : "text-white/40 text-xs font-medium flex items-center gap-1 mt-0.5"
                                }
                              >
                                {isMissed && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                )}
                                {isMissed
                                  ? t("Missed Call")
                                  : isIncoming
                                    ? t("Incoming Call")
                                    : t("Outgoing Call")}
                              </p>
                            </div>
                            <span className="text-white/30 text-[10px] font-medium">
                              {call.timestamp
                                ? new Date(
                                    call.timestamp.toMillis(),
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="absolute bottom-24 right-6 w-14 h-14 bg-linear-to-tr from-secondary to-primary rounded-full shadow-[0_8px_32px_rgba(34,211,238,0.4)] flex items-center justify-center z-20 text-black border border-white/20"
                  >
                    <Phone size={24} fill="currentColor" strokeWidth={0} />
                  </motion.button>
                </motion.div>
              )}

              {activeTab === "settings" && <Settings />}
              {activeTab === "updates" && <Updates contacts={contacts} />}
            </AnimatePresence>
          </div>
        </div>

        {/* Main Chat Area */}
          <div
          className={`flex-1 h-full relative ${!activeChat ? "hidden md:flex" : "flex"}`}
        >
          {activeChat ? (
            <ChatView
              contact={activeChat}
              onBack={() => setActiveChat(null)}
              onForward={(msg) => setForwardingMsg(msg)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-md space-y-8"
              >
                <div className="w-32 h-32 bg-white/5 rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl border border-white/10">
                  <Logo className="w-20 h-20" />
                </div>
                <div>
                  <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">
                    Welcome to LinkUpply
                  </h2>
                  <p className="text-white/50 leading-relaxed text-lg font-medium">
                    Select a contact to start chatting. Your messages are
                    end-to-end encrypted and synced across all your devices.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 text-sm text-primary font-bold uppercase tracking-[0.2em]">
                  <Sparkles size={18} /> Secure & Fast
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 w-full h-18 bg-[#0a0f1c]/95 backdrop-blur-xl border-t border-white/10 z-100 px-2 pb-safe flex items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.6)]">
        {navItems.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center justify-center gap-1 transition-all relative w-16 h-14 group ${activeTab === tab.id ? "text-primary" : "text-white/50 hover:text-white"}`}
          >
            <motion.div
              className="relative z-10"
              animate={{
                scale: activeTab === tab.id ? 1.15 : 1,
                y: activeTab === tab.id ? -6 : 0,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              {typeof tab.icon === "function" ? (
                <tab.icon />
              ) : (
                React.createElement(tab.icon as any, {
                  size: 22,
                  strokeWidth: activeTab === tab.id ? 2.5 : 2,
                })
              )}
              {tab.id === "home" && totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 bg-linear-to-br from-red-500 to-pink-500 text-white text-[9px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center border-2 border-black shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </motion.div>

            <span
              className={`text-[10px] font-medium tracking-wide absolute bottom-1 transition-opacity duration-200 ${activeTab === tab.id ? "opacity-0" : "opacity-0 group-hover:opacity-100"}`}
            >
              {tab.label}
            </span>

            {activeTab === tab.id && (
              <motion.div
                layoutId="mobileActiveTabIndicator"
                className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_10px_rgba(34,211,238,1)]"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}


function RequestsView({
  requests,
  contacts,
  onOpenChat,
}: {
  requests: any[];
  contacts: any[];
  onOpenChat: (contact: any) => void;
}) {
  const { user } = useAuth();
  const { t, lang } = useTranslation();
  const [searchId, setSearchId] = useState("");
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [isAlreadyFriend, setIsAlreadyFriend] = useState(false);
  const [acceptedIds, setAcceptedIds] = useState<string[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSearchResult(null);
    setIsSent(false);
    setIsAlreadyFriend(false);
    if (!searchId.trim()) return;
    setLoading(true);

    try {
      const trimmedId = searchId.trim();
      const q = query(
        collection(db, "users"),
        where("linkupId", "in", [
          trimmedId,
          trimmedId.toUpperCase(),
          trimmedId.toLowerCase(),
        ]),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setError(t("User not found. Check the LinkUpply ID!"));
      } else {
        const foundUser = snap.docs[0].data();
        if (foundUser.uid === user?.uid) {
          setError(t("You cannot add yourself"));
        } else {
          // Check if already a friend
          const isFriend = contacts.some((c) => c.id === foundUser.uid);
          if (isFriend) {
            setIsAlreadyFriend(true);
          }
          setSearchResult(foundUser);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async () => {
    if (!user || !searchResult || loading) return;
    setLoading(true);
    try {
      await setDoc(doc(db, "users", searchResult.uid, "requests", user.uid), {
        status: "pending",
        timestamp: serverTimestamp(),
      });
      setIsSent(true);
      
      const targetTokens = searchResult?.pushTokens?.length
        ? searchResult.pushTokens
        : searchResult?.pushToken
          ? [searchResult.pushToken]
          : [];
          
      if (targetTokens.length > 0) {
        try {
          await fetch("/api/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tokens: targetTokens,
              title: "New Friend Request",
              body: `${user.displayName || "Someone"} sent you a connection request!`,
              image: user.photoURL || undefined,
            }),
          });
        } catch (e) {
          console.error("Push notify error", e);
        }
      }

      setTimeout(() => {
        setSearchResult(null);
        setSearchId("");
        setIsSent(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (requester: any, accept: boolean) => {
    if (!user) return;
    try {
      if (accept) {
        await setDoc(
          doc(db, "users", user.uid, "contacts", requester.uid || requester.id),
          { addedAt: serverTimestamp() },
        );
        await setDoc(
          doc(db, "users", requester.uid || requester.id, "contacts", user.uid),
          { addedAt: serverTimestamp() },
        );
        await deleteDoc(
          doc(db, "users", user.uid, "requests", requester.uid || requester.id),
        );
        setAcceptedIds((prev) => [...prev, requester.uid || requester.id]);
        
        const targetTokens = requester?.pushTokens?.length
          ? requester.pushTokens
          : requester?.pushToken
            ? [requester.pushToken]
            : [];
            
        if (targetTokens.length > 0) {
          try {
            await fetch("/api/notify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tokens: targetTokens,
                title: "Request Accepted",
                body: `${user.displayName || "Someone"} accepted your connection request!`,
                image: user.photoURL || undefined,
              }),
            });
          } catch (e) {
            console.error("Push notify error", e);
          }
        }
      } else {
        await deleteDoc(
          doc(db, "users", user.uid, "requests", requester.uid || requester.id),
        );
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-10 p-2" dir={lang === 'ur' ? 'rtl' : 'ltr'}>
      <div className="space-y-4">
        <h2 className="text-[11px] font-bold text-white/50 uppercase tracking-[0.2em] px-2 flex items-center justify-between">
          <span>{t("Add New Link")}</span>
          <div className="w-1.5 h-1.5 rounded-full bg-primary/50"></div>
        </h2>
        <form onSubmit={handleSearch} className="flex gap-3 relative z-10">
          <div className="relative flex-1 group">
            <Search
              size={18}
              className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-primary transition-colors stroke-2"
            />
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder={t("Enter LinkUpply ID (e.g. john-123)")}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              dir="ltr"
              style={{ direction: "ltr", textAlign: "left" }}
              className="w-full bg-white/3 border border-white/10 rounded-full py-4 pl-12 pr-5 text-white focus:border-primary/40 focus:bg-white/5 outline-none transition-all placeholder:text-white/20 text-sm font-light backdrop-blur-xl hover:bg-white/5"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9, y: 2 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            type="submit"
            disabled={loading}
            className="bg-linear-to-tr from-secondary to-primary text-white font-bold px-7 rounded-full shadow-[0_0_24px_rgba(34,211,238,0.25)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] disabled:opacity-50 text-sm flex items-center justify-center transition-shadow"
          >
            {loading ? "..." : t("Find")}
          </motion.button>
        </form>
        {error && (
          <p className="text-red-400 text-xs px-4 font-medium">{error}</p>
        )}
        {searchResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 glass-morphism rounded-4xl flex items-center justify-between border border-white/8 bg-white/2"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={searchResult.photoURL || emojiToSVG(searchResult.emoji)}
                  alt="User"
                  className="w-12 h-12 rounded-full shadow-lg border border-white/10 object-cover"
                />
                <div className="absolute inset-0 rounded-full shadow-[inset_0_0_10px_rgba(255,255,255,0.1)] pointer-events-none"></div>
              </div>
              <div>
                <h3 className="font-semibold text-white text-base tracking-tight">
                  {searchResult.name}
                </h3>
                <p className="text-[10px] text-primary/80 font-bold uppercase tracking-widest mt-0.5">
                  {searchResult.linkupId}
                </p>
              </div>
            </div>
            {isAlreadyFriend ? (
              <div className="flex items-center gap-1.5 text-white/50 font-medium text-xs bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                <Check size={14} strokeWidth={2.5} />
                <span>{t("Linked")}</span>
              </div>
            ) : isSent ? (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                className="flex items-center gap-1.5 bg-linear-to-r from-emerald-500 to-green-400 text-white px-4 py-2 rounded-full shadow-lg"
              >
                <Check size={16} strokeWidth={3} />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {t("Sent")}
                </span>
              </motion.div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={loading}
                onClick={sendRequest}
                className="bg-white/10 text-white px-5 py-2 rounded-full font-semibold text-xs shadow-md border border-white/10 disabled:opacity-50 hover:bg-white/20 transition-all hover:border-white/20"
              >
                {loading ? "..." : t("Connect")}
              </motion.button>
            )}
          </motion.div>
        )}
      </div>

      <div className="space-y-4 pt-4">
        <h2 className="text-[11px] font-bold text-white/50 uppercase tracking-[0.2em] px-2 flex items-center justify-between">
          <span>{t("Pending Links")}</span>
          {requests.length > 0 && (
            <span className="bg-primary/20 text-primary text-[9px] px-2 py-0.5 rounded-full">
              {requests.length} {t("New")}
            </span>
          )}
        </h2>
        {requests.length === 0 && acceptedIds.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center p-12 py-20 rounded-[2.5rem] border border-dashed border-white/10 bg-white/2 relative overflow-hidden"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none"
            />
            <UserPlus className="text-white/20 mb-4 stroke-1" size={40} />
            <p className="text-white/40 text-sm font-medium tracking-wide">
              {t("No pending links at the moment")}
            </p>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((req) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 glass-morphism rounded-4xl flex items-center justify-between border border-white/8 bg-white/3"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={req.photoURL || emojiToSVG(req.emoji || "😀")}
                    alt="User"
                    className="w-12 h-12 rounded-full shadow-lg border border-white/10 object-cover"
                  />
                  <div>
                    <h3 className="font-semibold text-white text-base tracking-tight">
                      {req.name || "LinkUpply User"}
                    </h3>
                    <p className="text-[10px] text-primary/80 font-medium tracking-wide mt-0.5">
                      {t("wants to connect")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleRequest(req, true)}
                    className="bg-white text-[#0f172a] px-4 py-2 rounded-full font-bold text-xs shadow-md border border-transparent hover:bg-white/90 transition-colors"
                  >
                    {t("Accept")}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleRequest(req, false)}
                    className="bg-transparent border border-white/10 text-white/50 px-4 py-2 rounded-full font-bold text-xs hover:text-white hover:bg-white/5 transition-colors"
                  >
                    {t("Ignore")}
                  </motion.button>
                </div>
              </motion.div>
            ))}
            {acceptedIds.map((id) => {
              const requester =
                contacts.find((c) => c.id === id) ||
                requests.find((r) => r.id === id);
              if (!requester) return null;
              return (
                <motion.div
                  key={`accepted-${id}`}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="p-4 md:p-5 glass-morphism rounded-4xl flex items-center justify-between border-green-500/30 bg-green-500/5"
                >
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="relative">
                      <img
                        src={
                          requester.photoURL ||
                          emojiToSVG(requester.emoji || "😀")
                        }
                        alt="User"
                        className="w-12 h-12 md:w-14 md:h-14 rounded-2xl shadow-xl border-2 border-green-500/20 object-cover"
                      />
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 bg-green-500 text-white p-0.5 rounded-full shadow-lg"
                      >
                        <Check size={10} strokeWidth={4} />
                      </motion.div>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base md:text-lg tracking-tight">
                        {requester.name || "LinkUpply User"}
                      </h3>
                      <div className="flex items-center gap-1.5 text-green-400 font-bold text-[9px] md:text-[10px] uppercase tracking-widest">
                        {t("Successfully Linked")}
                      </div>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onOpenChat(requester)}
                    className="bg-primary text-[#0f172a] px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-primary/20 flex items-center gap-2"
                  >
                    <MessageSquare size={14} />
                    {t("Chat Now")}
                  </motion.button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
