import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, MessageSquare } from 'lucide-react';
import { emojiToSVG } from '../utils';

interface NotificationProps {
  show: boolean;
  senderName: string;
  message: string;
  senderEmoji?: string;
  senderPhoto?: string;
  onClose: () => void;
  onReply: () => void;
  onMarkAsRead: () => void;
}

export function NotificationOverlay({ 
  show, 
  senderName, 
  message, 
  senderEmoji, 
  senderPhoto, 
  onClose, 
  onReply, 
  onMarkAsRead 
}: NotificationProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -120, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-1000 p-4 pointer-events-auto"
        >
          <div className="relative max-w-md mx-auto p-[1.5px] rounded-4xl overflow-hidden bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="bg-[#0f172a]/95 backdrop-blur-3xl rounded-[1.9rem] p-4 text-white border border-white/5">
              {/* Top Row */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-linear-to-br from-blue-400 to-cyan-400 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <MessageSquare size={14} className="text-white" />
                  </div>
                  <span className="text-[10px] font-black tracking-[0.3em] text-white/40 uppercase">LinkUpply</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/30 font-bold">now</span>
                  <ChevronDown size={14} className="text-white/30" />
                </div>
              </div>

              {/* Content Row */}
              <div className="flex items-center gap-4 mb-4 px-1">
                <div className="relative">
                  <img 
                    src={senderPhoto || emojiToSVG(senderEmoji || '👤')} 
                    alt={senderName} 
                    className="w-14 h-14 rounded-full border-2 border-white/10 object-cover shadow-2xl"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0f172a]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-lg tracking-tight text-white">{senderName}</h4>
                  <p className="text-sm text-white/60 truncate font-medium">{message}</p>
                </div>
              </div>

              {/* Action Row */}
              <div className="flex items-center gap-3 border-t border-white/5 pt-3">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onReply();
                  }}
                  className="flex-1 py-2.5 text-xs font-black text-cyan-400 hover:bg-cyan-400/10 rounded-2xl transition-all uppercase tracking-[0.2em] active:scale-95"
                >
                  Reply
                </button>
                <div className="w-px h-5 bg-white/10" />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead();
                  }}
                  className="flex-1 py-2.5 text-xs font-black text-white/30 hover:text-white/60 hover:bg-white/5 rounded-2xl transition-all uppercase tracking-[0.2em] active:scale-95"
                >
                  Mark as Read
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
