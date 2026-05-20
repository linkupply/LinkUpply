import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from './Logo';

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2800); // Wait for animations to finish
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
            className="fixed inset-0 z-100000 flex flex-col items-center justify-center bg-[#0a0f1c] overflow-hidden"
          >
            {/* Dark background setup matching theme */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-[#000000] pointer-events-none" />

            {/* Glowing Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                boxShadow: [
                  "0 0 0px 0px rgba(59, 130, 246, 0)",
                  "0 0 100px 30px rgba(59, 130, 246, 0.4)",
                  "0 0 60px 15px rgba(59, 130, 246, 0.2)",
                  "0 0 120px 40px rgba(59, 130, 246, 0.5)"
                ]
              }}
              transition={{
                duration: 2,
                ease: "easeOut",
                boxShadow: { duration: 2, times: [0, 0.4, 0.7, 1] }
              }}
              className="w-32 h-32 md:w-40 md:h-40 relative rounded-full mb-8 z-10"
            >
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl mix-blend-screen" />
              <Logo className="w-full h-full relative z-20" />
            </motion.div>

            {/* Animated LinkUpply Name */}
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-linear-to-r from-blue-400 via-purple-500 to-cyan-400 tracking-tight z-10 relative">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                className="inline-block"
              >
                LinkUpply
              </motion.span>
            </h1>

            {/* RGB Laser Line */}
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "200px", opacity: [0, 1, 0] }}
              transition={{ delay: 1, duration: 1.5, ease: "easeInOut" }}
              className="h-0.5 mt-8 bg-linear-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] z-10"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actual App Content */}
      <div style={{ opacity: showSplash ? 0 : 1, transition: 'opacity 0.8s ease-out' }}>
        {children}
      </div>
    </>
  );
}
