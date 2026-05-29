import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from './Logo';

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2800); // Allow animations to finish
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
            className="fixed inset-0 z-100000 flex flex-col items-center justify-center bg-white overflow-hidden"
          >
            {/* White background matching theme */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-gray-50 pointer-events-none" />

            {/* Glowing Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                boxShadow: [
                  "0 0 0px 0px rgba(59, 130, 246, 0)",
                  "0 0 80px 20px rgba(59, 130, 246, 0.2)",
                  "0 0 40px 10px rgba(59, 130, 246, 0.1)",
                  "0 0 100px 30px rgba(59, 130, 246, 0.25)"
                ]
              }}
              transition={{
                duration: 2,
                ease: "easeOut",
                boxShadow: { duration: 2, times: [0, 0.4, 0.7, 1] }
              }}
              className="w-32 h-32 md:w-40 md:h-40 relative rounded-full mb-8 z-10"
            >
              <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl mix-blend-multiply" />
              <Logo className="w-full h-full relative z-20" />
            </motion.div>

            {/* Animated LinkUpply Name */}
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-linear-to-r from-blue-600 via-purple-600 to-cyan-500 tracking-tight z-10 relative">
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
              className="h-0.5 mt-8 bg-linear-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_10px_#60a5fa] z-10"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actual App Content */}
      <div 
        className="flex-1 w-full flex flex-col h-full"
        style={{ opacity: showSplash ? 0 : 1, transition: 'opacity 0.8s ease-out' }}
      >
        {children}
      </div>
    </>
  );
}
