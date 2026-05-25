import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, MoreVertical, Heart, Send, Eye, X, ChevronRight } from "lucide-react";
import { useAuth } from "../store";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { emojiToSVG } from "../utils";

export function StatusViewer({
  group,
  onClose,
  onNextGroup,
  onPrevGroup,
  contacts
}: {
  group: any;
  onClose: () => void;
  onNextGroup: () => void;
  onPrevGroup: () => void;
  contacts: any[];
}) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);

  const statuses = group.statuses;
  const currentStatus = statuses[currentIndex];
  const isMyStatus = group.user.id === user?.uid;

  if (!currentStatus) return null;

  useEffect(() => {
    setCurrentIndex(0);
  }, [group]);

  // Mark as viewed
  useEffect(() => {
    if (!user || isMyStatus || !currentStatus) return;
    const viewStatus = async () => {
      try {
        const viewers = currentStatus.viewers || [];
        if (!viewers.includes(user.uid)) {
          await updateDoc(doc(db, "statuses", currentStatus.id), {
            viewers: arrayUnion(user.uid)
          });
        }
      } catch (err) {
        console.error("Failed to mark status viewed", err);
      }
    };
    viewStatus();
  }, [currentStatus, user, isMyStatus]);

  useEffect(() => {
    if (isPaused || showViewers) return;

    let timer: any;
    if (currentStatus?.type === "image") {
      timer = setTimeout(() => {
        handleNext();
      }, 5000); // 5 seconds per image
    }
    return () => clearTimeout(timer);
  }, [currentIndex, currentStatus, isPaused, showViewers, group]);

  const handleNext = () => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      onClose();
    }
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
    const isYesterday =
      new Date(now.setDate(now.getDate() - 1)).getDate() === date.getDate() &&
      now.getMonth() === date.getMonth();

    const timeString = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (isToday) return `Today, ${timeString}`;
    if (isYesterday) return `Yesterday, ${timeString}`;
    return `${date.toLocaleDateString()}, ${timeString}`;
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed inset-0 z-200 bg-white flex flex-col items-center justify-center safe-top safe-bottom"
    >
      {/* Progress Bars */}
      <div className="absolute top-4 left-4 right-4 flex gap-1 z-50">
        {statuses.map((_: any, idx: number) => (
          <div
            key={idx}
            className="flex-1 h-1 bg-gray-500 rounded-full overflow-hidden backdrop-blur-sm"
          >
            <motion.div
              initial={{ width: idx < currentIndex ? "100%" : "0%" }}
              animate={{
                width:
                  idx < currentIndex
                    ? "100%"
                    : idx === currentIndex &&
                        currentStatus?.type === "image" &&
                        !isPaused && !showViewers
                      ? "100%"
                      : idx === currentIndex && (isPaused || showViewers)
                        ? "auto"
                        : "0%",
              }}
              transition={{
                duration:
                  idx === currentIndex &&
                  currentStatus?.type === "image" &&
                  !isPaused && !showViewers
                    ? 5
                    : 0,
                ease: "linear",
              }}
              className="h-full bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-8 left-4 right-4 flex justify-between items-center z-50 bg-linear-to-b from-black/60 to-transparent pb-4 pt-1 px-1 -mx-4">
        <div className="flex items-center gap-3 pl-4">
          <button
            onClick={onClose}
            className="text-gray-900 hover:bg-gray-100 p-2 rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <img
            src={group.user.photo}
            alt=""
            className="w-10 h-10 rounded-full object-cover border border-gray-200"
          />
          <div className="flex flex-col">
            <span className="text-gray-900 font-medium text-[15px]">
              {group.user.name}
            </span>
            <span className="text-gray-600 text-[12px]">
              {formatTime(currentStatus.timestamp)}
            </span>
          </div>
        </div>
        <button className="text-gray-900 mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors">
          <MoreVertical size={24} />
        </button>
      </div>

      {/* Media Viewer */}
      <div
        className="w-full h-full max-w-2xl relative flex items-center justify-center overflow-hidden bg-white/90"
        onMouseDown={() => !showViewers && setIsPaused(true)}
        onMouseUp={() => !showViewers && setIsPaused(false)}
        onTouchStart={() => !showViewers && setIsPaused(true)}
        onTouchEnd={() => !showViewers && setIsPaused(false)}
      >
        <div
          className="absolute left-0 top-[10%] bottom-[15%] w-1/3 z-40 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            if(!showViewers) handlePrev();
          }}
        />
        <div
          className="absolute right-0 top-[10%] bottom-[15%] w-1/3 z-40 flex items-center justify-end pr-4 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            if(!showViewers) handleNext();
          }}
        >
          <button className="z-50 p-2 bg-white/80 hover:bg-white/60 rounded-full backdrop-blur-md text-gray-900 transition-colors border border-gray-200 pointer-events-none">
             <ChevronRight size={28} />
          </button>
        </div>

        {currentStatus.type === "video" ? (
          <video
            src={currentStatus.mediaUrl}
            className="w-full h-full object-contain"
            autoPlay
            onEnded={() => { if(!showViewers) handleNext() }}
            playsInline
          />
        ) : (
          <img
            src={currentStatus.mediaUrl}
            className="w-full h-full object-contain select-none"
            draggable={false}
          />
        )}
      </div>

      {/* Bottom Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-12 md:p-6 md:pb-6 bg-linear-to-t from-black/80 via-black/40 to-transparent z-50 flex items-center gap-3">
        {isMyStatus ? (
          <div className="w-full flex flex-col items-center justify-center">
             <button 
                onClick={() => setShowViewers(true)}
                className="flex items-center gap-2 text-gray-800 bg-white/80 hover:bg-white/60 px-6 py-2.5 rounded-full backdrop-blur-md transition-all font-medium border border-gray-200"
             >
               <Eye size={18} />
               <span>{currentStatus.viewers?.length || 0} views</span>
             </button>
          </div>
        ) : (
          <>
            <div className="flex-1 relative group">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
                placeholder="Reply..."
                className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-500 text-gray-900 placeholder:text-gray-500 rounded-full py-3.5 pl-6 pr-12 outline-none border border-gray-200 focus:border-gray-300 backdrop-blur-md transition-all text-[15px]"
              />
              <AnimatePresence>
                {replyText && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors"
                  >
                    <Send size={16} className="ml-0.5" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            <button className="p-3.5 bg-gray-100 hover:bg-gray-500 rounded-full text-gray-900 transition-all backdrop-blur-md border border-gray-200 shrink-0">
              <Heart size={24} />
            </button>
          </>
        )}
      </div>

      {/* Viewers Bottom Sheet overlay */}
      <AnimatePresence>
        {showViewers && (
          <motion.div 
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 h-2/3 bg-white rounded-t-3xl border-t border-gray-200 z-300 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
          >
             <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="text-gray-900 font-semibold flex items-center gap-2">
                   <Eye size={18} className="text-primary"/> 
                   Viewed by {currentStatus.viewers?.length || 0}
                </h3>
                <button onClick={() => setShowViewers(false)} className="text-gray-500 hover:text-gray-900 p-1">
                   <X size={20} />
                </button>
             </div>
             <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                {(!currentStatus.viewers || currentStatus.viewers.length === 0) ? (
                   <div className="flex flex-col items-center justify-center p-10 text-gray-400 text-sm">
                      No views yet
                   </div>
                ) : (
                   currentStatus.viewers.map((vid: string) => {
                      const c = contacts.find(contact => contact.id === vid);
                      return (
                        <div key={vid} className="flex items-center gap-3 p-3 px-4 hover:bg-gray-50 rounded-2xl">
                           <img src={c?.photoURL || emojiToSVG(c?.emoji || '😀')} className="w-12 h-12 rounded-full object-cover border border-gray-200 bg-gray-50" />
                           <div className="flex flex-col">
                              <span className="text-gray-900 font-medium text-[15px]">{c?.name || 'Unknown User'}</span>
                              <span className="text-gray-400 text-[12px]">Viewed status</span>
                           </div>
                        </div>
                      )
                   })
                )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body
  );
}
