import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { db, storage } from "../firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../store";
import {
  Plus,
  Search,
  MoreVertical,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import { emojiToSVG } from "../utils";
import { StatusViewer } from "./StatusViewer";
import { useTranslation } from "../hooks/useTranslation";

export function Updates({ contacts }: { contacts: any[] }) {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [statuses, setStatuses] = useState<any[]>([]);
  const [viewingStatusGroup, setViewingStatusGroup] = useState<any | null>(
    null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch all statuses sorted by timestamp
    const q = query(collection(db, "statuses"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now();
      const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

      // Filter out expired statuses and keep only contacts or user's own status
      const active = docs.filter((d: any) => {
         const isNotExpired = d.expiresAt > now;
         const isSelf = d.userId === user?.uid;
         const isContact = contacts.some((c: any) => c.id === d.userId);
         return isNotExpired && (isSelf || isContact);
      });
      setStatuses(active);
    });
    return () => unsub();
  }, [user?.uid, contacts]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      let mediaUrl = "";
      
      // For images, bypass Firebase Storage to avoid "Storage not enabled" infinite pending issues.
      // We will compress the image using Canvas and save as base64 in Firestore directly.
      if (file.type.startsWith("image/")) {
        mediaUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const MAX_WIDTH = 800;
              const MAX_HEIGHT = 800;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");
              ctx?.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL("image/jpeg", 0.7)); // compress to 70% quality JPEG
            };
            img.onerror = () => reject("Image load error");
            img.src = event.target?.result as string;
          };
          reader.onerror = () => reject("File read error");
          reader.readAsDataURL(file);
        });
      } else {
        // For video, we still try Storage, but we add a timeout so it doesn't hang forever
        const uploadTask = async () => {
          const storageRef = ref(
            storage,
            `status_media/${user.uid}_${Date.now()}_${file.name}`
          );
          await uploadBytes(storageRef, file);
          return await getDownloadURL(storageRef);
        };
        
        mediaUrl = await Promise.race([
          uploadTask(),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Storage upload timed out. Did you enable Firebase Storage in your console?")), 15000))
        ]);
      }

      await addDoc(collection(db, "statuses"), {
        userId: user.uid,
        mediaUrl,
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        type: file.type.startsWith("video/") ? "video" : "image",
        userName: profile?.name || "Unknown",
        userPhoto: profile?.photoURL || emojiToSVG(profile?.emoji || "😀"),
      });
    } catch (err: any) {
      console.error("Upload failed", err);
      alert(err.message || "Upload failed. If uploading video, ensure Firebase Storage is enabled.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Group statuses by user
  const grouped = statuses.reduce(
    (acc, status) => {
      if (!acc[status.userId]) {
        const contactInfo = contacts?.find((c) => c.id === status.userId);
        acc[status.userId] = {
          user: {
            id: status.userId,
            name:
              status.userId === user?.uid
                ? "My Status"
                : contactInfo?.name || status.userName || "Unknown",
            photo:
              status.userId === user?.uid
                ? profile?.photoURL || emojiToSVG(profile?.emoji || "😀")
                : contactInfo?.photoURL ||
                  (contactInfo?.emoji ? emojiToSVG(contactInfo.emoji) : null) ||
                  status.userPhoto ||
                  emojiToSVG("😀"),
          },
          statuses: [],
        };
      }
      acc[status.userId].statuses.push(status);
      return acc;
    },
    {} as Record<string, any>,
  );

  const myStatusesGroup = grouped[user?.uid || ""]?.statuses || [];
  let otherGroups = Object.values(grouped).filter(
    (g: any) => g.user.id !== user?.uid,
  );

  // Sort groups by latest status
  otherGroups.sort((a: any, b: any) => {
    const lastA = a.statuses[a.statuses.length - 1].timestamp;
    const lastB = b.statuses[b.statuses.length - 1].timestamp;
    return lastB - lastA;
  });

  const handleViewGroup = (group: any) => {
    setViewingStatusGroup(group);
  };

  const navigateToNextGroup = () => {
    if (!viewingStatusGroup) return;
    if (viewingStatusGroup.user.id === user?.uid) {
      if (otherGroups.length > 0) handleViewGroup(otherGroups[0]);
      else setViewingStatusGroup(null);
      return;
    }
    const idx = otherGroups.findIndex(
      (g: any) => g.user.id === viewingStatusGroup.user.id,
    );
    if (idx !== -1 && idx < otherGroups.length - 1) {
      handleViewGroup(otherGroups[idx + 1]);
    } else {
      setViewingStatusGroup(null);
    }
  };

  const navigateToPrevGroup = () => {
    if (!viewingStatusGroup) return;
    if (viewingStatusGroup.user.id === user?.uid) {
      setViewingStatusGroup(null);
      return;
    }
    const idx = otherGroups.findIndex(
      (g: any) => g.user.id === viewingStatusGroup.user.id,
    );
    if (idx > 0) {
      handleViewGroup(otherGroups[idx - 1]);
    } else if (myStatusesGroup.length > 0) {
      handleViewGroup({
        user: {
          id: user?.uid,
          name: "My Status",
          photo: profile?.photoURL || emojiToSVG(profile?.emoji || "😀"),
        },
        statuses: myStatusesGroup,
      });
    } else {
      setViewingStatusGroup(null);
    }
  };

  return (
    <motion.div
      key="updates"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="p-0 h-full overflow-y-auto custom-scrollbar flex flex-col w-full relative pb-24 md:pb-4"
    >
      <div className="px-6 pt-6 pb-2">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
          {t("Updates")}
        </h2>
      </div>

      <div className="px-6 flex-1 mt-4">
        {/* Add Status Button Pattern */}
        <div 
           onClick={() => fileInputRef.current?.click()}
           className="flex items-center gap-4 p-3 hover:bg-gray-100 rounded-2xl cursor-pointer transition-colors active:bg-gray-200"
        >
          <div className="w-13 h-13 shrink-0 rounded-full overflow-hidden bg-gray-50 flex items-center justify-center relative border border-gray-200">
             <img src={profile?.photoURL || emojiToSVG(profile?.emoji || "😀")} className="w-full h-full object-cover opacity-50" alt="Me" />
             <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-lg">
                   <Plus size={16} strokeWidth={3} />
                 </div>
             </div>
          </div>
          <div className="flex-1">
             <h3 className="text-[16px] font-medium text-gray-900">{t("My status")}</h3>
             <p className="text-[13px] text-gray-500">{t("Tap to add status update")}</p>
          </div>
        </div>

        <h3 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mt-8 mb-4 px-2">
          {t("Recent updates")}
        </h3>

        {otherGroups.length === 0 && myStatusesGroup.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-3xl border border-gray-100">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <ImageIcon size={28} />
            </div>
            <h4 className="text-gray-900 font-medium mb-1">No updates yet</h4>
            <p className="text-gray-400 text-[14px]">
              Check back later for new stories from your contacts.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {myStatusesGroup.length > 0 && (
              <div
                onClick={() =>
                  handleViewGroup({
                    user: {
                      id: user?.uid,
                      name: "My Status",
                      photo:
                        profile?.photoURL || emojiToSVG(profile?.emoji || "😀"),
                    },
                    statuses: myStatusesGroup,
                  })
                }
                className="flex items-center gap-4 p-3 hover:bg-gray-100 rounded-2xl cursor-pointer transition-colors active:bg-gray-200"
              >
                <div className="w-13 h-13 shrink-0 rounded-full overflow-hidden border-2 border-primary p-0.5">
                  <img
                    src={
                      profile?.photoURL || emojiToSVG(profile?.emoji || "😀")
                    }
                    alt="My Status"
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-[16px] font-medium text-gray-900">
                    My status (View)
                  </h3>
                  <p className="text-[13px] text-gray-500">
                    {new Date(
                      myStatusesGroup[myStatusesGroup.length - 1].timestamp,
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            )}

            {otherGroups.map((group: any, idx: number) => (
              <div
                key={idx}
                onClick={() => handleViewGroup(group)}
                className="flex items-center gap-4 p-3 hover:bg-gray-100 rounded-2xl cursor-pointer transition-colors active:bg-gray-200"
              >
                <div className="w-13 h-13 shrink-0 rounded-full overflow-hidden border-2 border-emerald-500 p-0.5">
                  <img
                    src={group.user.photo}
                    alt={group.user.name}
                    className="w-full h-full object-cover rounded-full bg-gray-100"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-[16px] font-medium text-gray-900">
                    {group.user.name}
                  </h3>
                  <p className="text-[13px] text-gray-500">
                    {new Date(
                      group.statuses[group.statuses.length - 1].timestamp,
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        type="file"
        accept="image/*,video/*"
        ref={fileInputRef}
        onChange={handleUpload}
        className="hidden"
      />

      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl z-50 whitespace-nowrap"
          >
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Uploading status...</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingStatusGroup && (
          <StatusViewer
            key={viewingStatusGroup.user.id}
            group={viewingStatusGroup}
            contacts={contacts}
            onClose={() => setViewingStatusGroup(null)}
            onNextGroup={navigateToNextGroup}
            onPrevGroup={navigateToPrevGroup}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
