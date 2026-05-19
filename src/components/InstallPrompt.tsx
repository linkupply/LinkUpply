import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';
import { Logo } from './Logo';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Wait 4 seconds before showing
      setTimeout(() => {
        const hasDismissed = localStorage.getItem('installPromptDismissed');
        if (!hasDismissed) {
          setShowPrompt(true);
        }
      }, 4000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also trigger manually if not fired but we still want to show UI after 4 sec
    // Just a fallback in case browser doesn't support event or it already fired
    const fallbackTimeout = setTimeout(() => {
      if (!deferredPrompt && !isInstalled) {
        const hasDismissed = localStorage.getItem('installPromptDismissed');
        if (!hasDismissed) {
          setShowPrompt(true);
        }
      }
    }, 4000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(fallbackTimeout);
    };
  }, [deferredPrompt, isInstalled]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      // Provide instruction for manual install
      alert("To install: tap the browser menu and select 'Add to Home Screen' or 'Install App'.");
      setShowPrompt(false);
    }
  };

  const handleClose = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          onClick={handleClose}
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-sm glass-morphism rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_rgba(30,136,229,0.3)] overflow-hidden p-8 flex flex-col items-center bg-[#0f172a]"
        >
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          <div className="w-24 h-24 mb-6 relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            <Logo className="w-full h-full relative z-10 drop-shadow-2xl" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight text-center">
            Install LinkUpply
          </h2>
          <p className="text-white/60 text-[15px] text-center mb-8 font-medium">
            Get the full app experience on your device. Fast, seamless, and always connected.
          </p>

          <button
            onClick={handleInstallClick}
            className="w-full relative group mb-6"
          >
            <div className="absolute inset-0 rounded-2xl bg-linear-to-r from-primary via-secondary to-primary blur-lg opacity-60 group-hover:opacity-100 transition duration-500" />
            <div className="relative w-full bg-primary text-black font-bold text-lg py-4 rounded-2xl flex items-center justify-center transition-transform group-active:scale-95 shadow-xl">
              Install Now
            </div>
          </button>

          <div className="flex flex-col items-center gap-4 text-white/50 w-full mt-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] flex flex-col items-center gap-3 w-full">
              <span>Install on</span>
              <div className="flex items-center justify-center gap-8 w-full px-4">
                
                {/* Windows Window Logo */}
                <div className="flex flex-col items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                  <svg viewBox="0 0 88 88" className="w-6 h-6 fill-current">
                    <path d="M0 12.402l35.687-4.86.016 34.423-35.703.206v-29.77zm35.67 33.53l-.015 33.914-35.655-4.803v-29.35l35.67.24zm4.326-39.02l48.004-6.912v40.093l-48.004.422v-33.603zm48.004 38.358v40.354l-48.004-6.732v-34.133l48.004.51z"/>
                  </svg>
                  <span className="text-[9px]">Windows</span>
                </div>

                {/* Android Logo */}
                <div className="flex flex-col items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                    <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-2.86-1.21-6.08-1.21-8.94 0L5.65 5.67c-.19-.29-.58-.38-.87-.22-.29.15-.42.54-.26.85l1.84 3.18C2.72 11.41.22 15.34 0 20h24c-.22-4.66-2.72-8.59-6.4-10.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/>
                  </svg>
                  <span className="text-[9px]">Android</span>
                </div>

                {/* Apple logo */}
                <div className="flex flex-col items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                  <svg viewBox="0 0 384 512" className="w-6 h-6 fill-current">
                    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                  </svg>
                  <span className="text-[9px]">iOS</span>
                </div>

              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
