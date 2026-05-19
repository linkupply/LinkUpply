import React, { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  getRedirectResult,
  GoogleAuthProvider, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, getDoc, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../store';
import { generateLinkUpplyId, emojiToSVG, getFirebaseErrorMessage } from '../utils';
import { showSystemNotification, registerWebPush } from '../services/notificationService';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from './Logo';
import { UserPlus, Chrome, Mail, Lock, Eye, EyeOff, ArrowLeft, Trash2, User, Briefcase } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

// Mobile detection
const isNative = window.hasOwnProperty('Capacitor');
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export function Auth() {
  const { user, profile, loading } = useAuth();
  const { t, lang } = useTranslation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle redirect result for mobile
  useEffect(() => {
    getRedirectResult(auth).then((result) => {
      if (result) {
        console.log("Redirect result success:", result.user.uid);
      }
    }).catch((err) => {
      console.error("Redirect result error:", err);
      if (err.code !== 'auth/no-recent-redirect-operation') {
        setError(getFirebaseErrorMessage(err));
      }
    });
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) return setError('Photo must be smaller than 500KB');
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setError('');
    
    // Request Notification Permission explicitely during UI interaction
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
          await Notification.requestPermission();
        }
      } catch (err) { }
    }
    
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      await registerWebPush();
      showSystemNotification("Login Successful", "Welcome to LinkUpply!");
    } catch (err: any) {
      console.error("Google Login Error:", err);
      setError(getFirebaseErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');
    
    // Request Notification Permission explicitely during UI interaction
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
          await Notification.requestPermission();
        }
      } catch (err) { }
    }
    
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        showSystemNotification("Registration Successful", "Welcome to LinkUpply!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        showSystemNotification("Login Successful", "Welcome back to LinkUpply!");
      }
      await registerWebPush();
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) return setError('Please enter your email address first.');
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent!');
      setError('');
    } catch (err: any) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (name.length > 20) return setError('Name must be less than 20 characters.');
    if (role.length > 50) return setError('Role must be less than 50 characters.');
    if (bio.length > 100) return setError('Bio must be less than 100 characters.');

    setIsSubmitting(true);
    setError('');
    try {
      // Double check if profile already exists
      const userRef = doc(db, 'users', user.uid);
      try {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          // Profile already exists, the store listener will handle it
          return;
        }
      } catch (e: any) { throw new Error('Check_User: ' + e.message); }

      let linkupId = generateLinkUpplyId(name);
      try {
        const q = query(collection(db, 'users'), where('linkupId', '==', linkupId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) linkupId = generateLinkUpplyId(name);
      } catch (e: any) { throw new Error('Check_ID: ' + e.message); }

      try {
        await setDoc(userRef, {
          uid: user.uid,
          name: name.trim(),
          email: user.email,
          role: role.trim(),
          bio: bio.trim(),
          emoji: '👤',
          photoURL,
          linkupId,
          isOnline: true,
          lastChanged: serverTimestamp()
        });
      } catch (e: any) { throw new Error('Save_Profile: ' + e.message); }

      // Request Notification Permission on Signup explicitely (needed for Safari / Desktop)
      if (typeof window !== "undefined" && "Notification" in window) {
        try {
          if (Notification.permission !== "granted") {
            await Notification.requestPermission();
          }
        } catch (err) {
          console.warn("Notification permission prompt failed", err);
        }
      }

      // Register web push (it handles web permissions internally and saves token natively if on mobile... wait this is just for web)
      await registerWebPush();

      // Delay pushing welcome notification to FCM to allow token initialization
      setTimeout(async () => {
        try {
          const freshSnap = await getDoc(userRef);
          if (freshSnap.exists()) {
            const userData = freshSnap.data();
            const tokens = userData.pushTokens?.length ? userData.pushTokens : (userData.pushToken ? [userData.pushToken] : []);
            if (tokens.length > 0) {
              await fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tokens: tokens,
                  title: 'Welcome to LinkUpply! 🚀',
                  body: `Hey ${name.trim()}, we're so glad you're here! Start linking up with your world.`,
                  image: 'https://linkupply-4ffb4.web.app/icon-192.png', // Or the official logo
                  data: { senderId: 'linkup_official' }
                })
              });
              return;
            }
          }
          // Fallback if no token yet
          showSystemNotification(
            'Welcome to LinkUpply! 🚀',
            `Hey ${name.trim()}, we're so glad you're here! Start linking up with your world.`,
            'linkup_official'
          );
        } catch(e) {
             console.error("Welcome push error:", e);
        }
      }, 5000);

      try {
        // Add official account to contacts and send first message
        const officialContactRef = doc(db, 'users', user.uid, 'contacts', 'linkup_official');
        await setDoc(officialContactRef, { addedAt: serverTimestamp(), official: true });
      } catch (e: any) { throw new Error('Save_Contact: ' + e.message); }

      const chatId = [user.uid, 'linkup_official'].sort().join('_');
      
      try {
        await setDoc(doc(db, 'chats', chatId), {
          participants: [user.uid, 'linkup_official'],
          lastMessage: 'Welcome to LinkUpply!',
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
          official: true
        }, { merge: true });

        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          senderId: 'linkup_official',
          text: `Welcome to LinkUpply, ${name.trim()}! 🚀 We're excited to have you on board. Feel free to explore and connect with others!`,
          timestamp: serverTimestamp()
        });
      } catch (chatErr: any) {
        throw new Error('Save_Chat: ' + chatErr.message);
      }

    } catch (err: any) {
      console.error("Profile setup error:", err);
      // We don't use getFirebaseErrorMessage here so we can see the custom prefix
      setError(err.message || 'Unknown Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-primary">Loading LinkUpply...</div>;

  if (!user) {
    return (
      <div 
        className="flex-1 flex flex-col items-center justify-start p-4 min-h-dvh overflow-y-auto pt-10 pb-10 bg-transparent"
        dir={lang === 'ur' ? 'rtl' : 'ltr'}
      >
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md mb-8 flex items-center justify-center gap-3 shrink-0"
        >
          <Logo className="w-16 h-16 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]" />
          <span className="text-4xl font-bold text-primary tracking-tighter drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">LinkUpply</span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md glass-morphism rounded-[2.5rem] p-6 md:p-10 shrink-0 mb-8"
        >
          <p className="text-white/60 text-sm mb-2 text-center font-medium">Connect with your world</p>
          <h1 className="text-3xl font-bold text-primary mb-8 text-center">
            {isSignUp ? 'Sign Up' : 'Login'}
          </h1>

          <form onSubmit={handleEmailAuth} className="space-y-5">
            <div>
              <input 
                type="email" 
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                style={{ direction: 'ltr', textAlign: 'left' }}
                className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition text-white placeholder:text-white/30 backdrop-blur-md"
                required
              />
            </div>
            <div>
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                style={{ direction: 'ltr', textAlign: 'left' }}
                className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition text-white placeholder:text-white/30 backdrop-blur-md"
                required
              />
            </div>

            <div className="flex items-center justify-between text-sm px-1">
              <label className="flex items-center gap-2 text-white/60 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary"
                />
                Show password
              </label>
              {!isSignUp && (
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-primary font-bold hover:text-primary/80 transition"
                >
                  Forgot password?
                </button>
              )}
            </div>

            {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-sm text-center font-medium bg-red-400/10 py-2 rounded-xl border border-red-400/20">{error}</motion.p>}
            {message && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-green-400 text-sm text-center font-medium bg-green-400/10 py-2 rounded-xl border border-green-400/20">{message}</motion.p>}

              <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-linear-to-r from-secondary to-primary text-[#0f172a] font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] disabled:opacity-50"
            >
              {isSubmitting ? (isSignUp ? 'Signing Up...' : 'Logging In...') : (isSignUp ? 'Sign Up' : 'Login')}
            </motion.button>

            <div className="relative flex items-center py-2">
              <div className="grow border-t border-white/10"></div>
              <span className="shrink mx-4 text-white/30 text-xs font-bold uppercase tracking-widest">or</span>
              <div className="grow border-t border-white/10"></div>
            </div>

            <motion.button 
              whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.05)" }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleGoogleLogin}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-3 border border-white/10 py-4 rounded-2xl transition text-white font-bold mb-4 disabled:opacity-50"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              {isSubmitting ? 'Connecting...' : (isSignUp ? 'Sign Up with Google' : 'Login with Google')}
            </motion.button>

            {!isSignUp ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-white/40 font-medium uppercase tracking-widest">New to LinkUpply?</p>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-primary font-bold hover:bg-white/10 transition shadow-xl"
                >
                  Create New Account
                </motion.button>
              </div>
            ) : (
              <p className="text-center text-sm text-white/60 mt-6">
                Already a member?{' '}
                <button 
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="text-primary font-bold hover:text-primary/80 transition"
                >
                  Login
                </button>
              </p>
            )}
          </form>
        </motion.div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div 
        className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto"
        dir={lang === 'ur' ? 'rtl' : 'ltr'}
      >
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto w-full glass-morphism rounded-[2.5rem] p-6 md:p-10 relative"
        >
          {/* Top Bar matching image structure */}
          <div className="flex items-center gap-4 mb-10">
            <button type="button" onClick={() => auth.signOut()} className="w-12 h-12 rounded-[1.25rem] bg-white/5 border border-white/10 flex items-center justify-center text-primary hover:bg-white/10 transition shrink-0">
              <ArrowLeft size={24} />
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-white leading-tight">Profile Set Up</h1>
              <p className="text-sm text-white/50 leading-tight">Add your details</p>
            </div>
          </div>

          <h2 className="text-4xl font-extrabold mb-10 text-center text-white tracking-tight">Add Your Details</h2>
          
          <form onSubmit={handleProfileSetup} className="flex flex-col gap-6">
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-6">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/10 bg-white/5 flex items-center justify-center shadow-xl">
                  {photoURL ? (
                    <img src={photoURL} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User size={48} className="text-white/20" />
                  )}
                </div>
                {photoURL && (
                  <button 
                    type="button" 
                    onClick={() => setPhotoURL('')} 
                    className="absolute -bottom-2 lg:-bottom-2 left-1/2 -translate-x-1/2 bg-[#ef4444]/20 hover:bg-[#ef4444]/40 p-2.5 rounded-full text-[#ef4444] transition backdrop-blur-md shadow-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              
              <button 
                type="button" 
                onClick={() => document.getElementById('photo-upload')?.click()} 
                className="bg-primary/20 text-primary hover:bg-primary/30 px-8 py-3 rounded-2xl font-bold text-sm transition"
              >
                Change Picture
              </button>
              <input 
                id="photo-upload"
                type="file" 
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-white/60 ml-1">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40">
                  <User size={20} />
                </div>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value.substring(0, 20))}
                  placeholder="achmadkikikarisma"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-white/60 ml-1">Role</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40">
                  <Briefcase size={20} />
                </div>
                <input 
                  type="text" 
                  value={role} 
                  onChange={e => setRole(e.target.value.substring(0, 50))}
                  placeholder="Product Designer"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-white/60 ml-1">Bio</label>
              <textarea 
                value={bio} 
                onChange={e => setBio(e.target.value.substring(0, 100))}
                placeholder="About"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none transition font-medium min-h-30"
              />
            </div>

            {error && <p className="text-red-400 text-sm text-center font-medium bg-red-400/10 py-2 rounded-xl border border-red-400/20">{error}</p>}
            
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isSubmitting}
              className="bg-linear-to-r from-secondary to-primary text-[#0f172a] font-bold py-4 rounded-2xl mt-4 hover:brightness-110 transition shadow-lg shadow-primary/20 disabled:opacity-50 text-lg"
            >
              {isSubmitting ? 'Setting up...' : 'Next'}
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  return null;
}
