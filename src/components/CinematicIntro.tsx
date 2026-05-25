import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Play } from 'lucide-react';

export function CinematicIntro() {
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setStage(1);
      const t1 = setTimeout(() => setStage(2), 1000); // "Build By"
      const t2 = setTimeout(() => setStage(3), 2500); // "MUHAMMAD"
      const t3 = setTimeout(() => setStage(4), 3800); // "ATIF"
      const t4 = setTimeout(() => {
        setIsOpen(false);
        window.dispatchEvent(new Event('showInstallPrompt'));
      }, 7000); // Auto-close and trigger prompt

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    } else {
      setStage(0);
    }
  }, [isOpen]);

  const handleSkip = () => {
    setIsOpen(false);
    window.dispatchEvent(new Event('showInstallPrompt'));
  };

  const overlayContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8 } }}
          className="fixed inset-0 z-99999 flex flex-col items-center justify-center glass-panel overflow-hidden bg-white"
        >
          {/* Hyperspace / Starfield Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ willChange: 'transform' }}>
              {[...Array(30)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{
                    x: '50vw',
                    y: '50vh',
                    scale: 0,
                    opacity: 1
                  }}
                  animate={{
                    x: `${50 + (Math.random() - 0.5) * 200}vw`,
                    y: `${50 + (Math.random() - 0.5) * 200}vh`,
                    scale: Math.random() * 2 + 0.5,
                    opacity: 0,
                  }}
                  transition={{
                    duration: Math.random() * 3 + 1.5,
                    repeat: Infinity,
                    ease: 'easeOut',
                    delay: Math.random() * 2
                  }}
                  className="absolute w-1 h-1 bg-white rounded-full shadow-[0_0_10px_#fff]"
                  style={{
                     background: i % 3 === 0 ? '#60a5fa' : i % 3 === 1 ? '#a78bfa' : '#fff'
                  }}
                />
              ))}
          </div>

          {/* Spotlight pulses */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.2, 0.4, 0.2, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute top-0 w-full h-[50vh] bg-linear-to-b from-blue-600/30 to-transparent pointer-events-none"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0.1, 0] }}
            transition={{ duration: 5, repeat: Infinity, delay: 2 }}
            className="absolute bottom-0 w-full h-[50vh] bg-linear-to-t from-purple-600/30 to-transparent pointer-events-none"
          />

          <button
            onClick={handleSkip}
            className="absolute top-8 right-8 px-6 py-2 border border-gray-200 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 hover:border-gray-1000 transition-all z-50 text-xs tracking-[0.2em] uppercase font-bold backdrop-blur-md"
          >
            Skip
          </button>

          <div className="relative z-10 flex flex-col items-center justify-center w-full px-4 text-center">
            
            {/* Build By */}
            <AnimatePresence>
              {stage >= 2 && (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  variants={{
                    visible: { transition: { staggerChildren: 0.1 } },
                    hidden: {}
                  }}
                  className="text-gray-700 font-mono text-sm sm:text-lg md:text-xl uppercase mb-10 z-10 font-bold tracking-[0.5em] flex items-center gap-1"
                >
                  {/* Glitch / Reveal effect for "BUILD BY" */}
                  {"BUILD BY".split("").map((char, index) => (
                    <motion.span
                      key={index}
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: { opacity: 1, y: 0 }
                      }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                      {char === " " ? "\u00A0" : char}
                    </motion.span>
                  ))}
                  <motion.div 
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.8 }}
                    className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6] ml-2"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Name Block */}
            <div className="flex flex-col items-center relative">
              
              {/* MUHAMMAD - Chrome finish staggered */}
              <AnimatePresence>
                {stage >= 3 && (
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: { transition: { staggerChildren: 0.08 } },
                      hidden: {}
                    }}
                    className="flex text-5xl sm:text-[5rem] md:text-[8rem] lg:text-[10rem] font-black uppercase tracking-tighter leading-none relative z-20"
                    style={{ filter: 'drop-shadow(0 15px 30px rgba(0,0,0,0.9))' }}
                  >
                    {"MUHAMMAD".split("").map((char, i) => (
                       <motion.span
                         key={i}
                         variants={{
                           hidden: { opacity: 0, y: -80, rotateX: 90, scale: 0.5 },
                           visible: { opacity: 1, y: 0, rotateX: 0, scale: 1 }
                         }}
                         transition={{ duration: 1.2, type: 'spring', bounce: 0.5 }}
                         style={{
                           background: 'linear-gradient(to bottom, #ffffff 0%, #a1a1aa 50%, #3f3f46 51%, #e4e4e7 100%)',
                           WebkitBackgroundClip: 'text',
                           WebkitTextFillColor: 'transparent',
                         }}
                       >
                         {char}
                       </motion.span>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ATIF - Chromatic Aberration & Neon split */}
              <AnimatePresence>
                {stage >= 4 && (
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: { transition: { staggerChildren: 0.15 } },
                      hidden: {}
                    }}
                    className="relative z-30 w-full flex justify-center mt-2 md:mt-4 lg:mt-6 group perspective-1000"
                  >
                    {/* Laser beam sweep */}
                    <motion.div 
                      initial={{ left: '-20%', opacity: 1 }}
                      animate={{ left: '120%', opacity: [1, 1, 0] }}
                      transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }}
                      className="absolute top-1/2 -translate-y-1/2 w-100 h-1.25 bg-white shadow-[0_0_50px_15px_#fff,0_0_100px_30px_#0ea5e9] z-50 pointer-events-none skew-x-45"
                    />
                    
                    <div className="flex text-[5rem] sm:text-[8rem] md:text-[13rem] lg:text-[16rem] font-black uppercase tracking-tighter leading-[0.85] text-gray-900" style={{ willChange: 'opacity, transform' }}>
                      {"ATIF".split("").map((char, i) => (
                        <motion.span
                          key={i}
                          variants={{
                            hidden: { opacity: 0, scale: 1.5, rotateY: 30 },
                            visible: { opacity: 1, scale: 1, rotateY: 0 }
                          }}
                          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
                          className="relative inline-block text-glow-atif"
                          style={{
                             textShadow: '0 0 10px #ffffff, 0 0 20px #0ea5e9, 3px 0px 0px rgba(255,0,0,0.5), -3px 0 0px rgba(0,255,255,0.5)'
                          }}
                        >
                          {char}
                        </motion.span>
                      ))}
                    </div>

                    {/* Shockwave expanding out */}
                    <motion.div
                      initial={{ scale: 0, opacity: 1, borderWidth: '0px' }}
                      animate={{ scale: [1, 3], opacity: [1, 0], borderWidth: ['10px', '0px'] }}
                      transition={{ duration: 1.5, ease: 'easeOut' }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-50 h-12.5 rounded-[100%] border-gray-200 mix-blend-screen -z-10"
                    />

                    {/* Massive colored bloom */}
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1.2, opacity: [0, 0.3, 0] }}
                      transition={{ duration: 2, ease: 'easeOut' }}
                      className="absolute inset-0 bg-blue-500 rounded-[100%] mix-blend-screen -z-20 scale-150"
                      style={{ filter: 'blur(50px)' }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <style>{`
        @keyframes rgb-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .rgb-border {
          background: conic-gradient(from 0deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0000ff, #8000ff, #ff0080, #ff0000);
          animation: rgb-spin 3s linear infinite;
        }
        .glass-panel {
          background: radial-gradient(circle at center, #111 0%, #000 100%);
        }
        .text-glow-atif {
          text-shadow: 
            0 0 10px #ffffff,
            0 0 20px #0ea5e9,
            0 0 40px #0ea5e9,
            0 0 80px #6366f1,
            0 0 120px #8b5cf6;
        }
      `}</style>
      
      <button 
        onClick={() => setIsOpen(true)}
        title="Play Cinematic Intro"
        className="relative flex items-center justify-center p-3 ml-2 outline-none group cursor-pointer shrink-0 w-10 h-10 rounded-full"
      >
        {/* Intense glow footprint */}
        <div className="absolute -inset-1 rgb-border blur-md opacity-60 group-hover:opacity-100 transition-opacity duration-300 rounded-full pointer-events-none" />
        
        {/* Animated Spin Border */}
        <div className="absolute inset-0 rgb-border rounded-full pointer-events-none" />
        
        {/* Inner core */}
        <div className="absolute inset-0.5 bg-black rounded-full z-0 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-white/10 group-hover:bg-white/20 transition-colors" />
        </div>
        
        <Play size={18} className="relative z-10 text-white fill-white ml-0.5 drop-shadow-[0_0_8px_rgba(255,255,255,1)]" />
      </button>

      {typeof document !== 'undefined' ? createPortal(overlayContent, document.body) : overlayContent}
    </>
  );
}
