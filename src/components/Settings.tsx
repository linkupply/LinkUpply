import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../store";
import { emojiToSVG, getFirebaseErrorMessage } from "../utils";
import { Key, Lock, Globe, HelpCircle, ArrowLeft, Smartphone, FileText, Trash2, CheckCircle2, ShieldAlert, Mail, Phone, UserX, Palette, Sparkles, LogOut, Trash, X } from "lucide-react";
import { doc, updateDoc, getDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { useTranslation } from "../hooks/useTranslation";
import emailjs from "@emailjs/browser";

export function Settings() {
  const { user, profile, setIsLoggingOut, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const [appLang, setAppLang] = useState(localStorage.getItem('appLang') || 'en');
  const [secNotif, setSecNotif] = useState(profile?.securityNotifications ?? true);
  const [readReceipts, setReadReceipts] = useState(profile?.privacy?.readReceipts ?? true);
  const [blockedUsersInfo, setBlockedUsersInfo] = useState<any[]>([]);

  // Profile Edit State
  const [name, setName] = useState(profile?.name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [emoji, setEmoji] = useState(profile?.emoji || "😀");
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || "");
  const [loadingProfile, setLoadingProfile] = useState(false);

  const emojis = [
    "😀", "😎", "🔥", "✨", "🚀", "🌈", "🍕", "🎸", "🎮", "💡", "🤖", "🦊", "🐼", "🦄", "🍀",
  ];

  // Delete Account State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Support Form State
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [isSendingSupport, setIsSendingSupport] = useState(false);

  // Terms Modal State
  const [showTermsModal, setShowTermsModal] = useState(false);

  const isGoogle = user?.providerData.some((p) => p.providerId === "google.com");

  useEffect(() => {
    async function fetchBlockedUsers() {
      if (!profile?.blockedUsers?.length) {
        setBlockedUsersInfo([]);
        return;
      }
      const fetchList = await Promise.all(
        profile.blockedUsers.map(async (uid) => {
          const uDoc = await getDoc(doc(db, "users", uid));
          return uDoc.exists() ? { id: uid, ...uDoc.data() } : null;
        })
      );
      setBlockedUsersInfo(fetchList.filter(Boolean));
    }
    fetchBlockedUsers();
  }, [profile?.blockedUsers]);

  const { t } = useTranslation();

  const handleLangSelect = (lang: string) => {
    setAppLang(lang);
    localStorage.setItem('appLang', lang);
    window.dispatchEvent(new Event('lang-change'));
  };

  const handleSecNotifToggle = async () => {
    const newVal = !secNotif;
    setSecNotif(newVal);
    if (user) {
      await updateDoc(doc(db, "users", user.uid), { securityNotifications: newVal });
    }
  };

  const handleReadReceiptsToggle = async () => {
    const newVal = !readReceipts;
    setReadReceipts(newVal);
    if (user) {
      await updateDoc(doc(db, "users", user.uid), { "privacy.readReceipts": newVal });
    }
  };

  const handleUnblock = async (targetUid: string) => {
    if (!user || !profile) return;
    const newList = (profile.blockedUsers || []).filter((u) => u !== targetUid);
    await updateDoc(doc(db, "users", user.uid), { blockedUsers: newList });
    setBlockedUsersInfo(prev => prev.filter(u => u.id !== targetUid));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) return alert("Photo must be smaller than 500KB");
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!name.trim()) return;
    setLoadingProfile(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: name.trim(),
        bio: bio.trim(),
        emoji,
        photoURL,
      });
      // Update local state is not strictly needed as context updates it, but feels smoother
    } catch (err) {
      console.error("Profile update error:", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      // Re-authenticate
      if (isGoogle) {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } else {
        if (!deletePassword) {
          setDeleteError("Please enter your password to confirm.");
          setIsDeleting(false);
          return;
        }
        await signInWithEmailAndPassword(auth, user.email!, deletePassword);
      }

      setIsLoggingOut(true);

      const userRef = doc(db, "users", user.uid);
      await deleteDoc(userRef);

      await user.delete();
    } catch (err: any) {
      console.error("Account deletion error:", err);
      setIsLoggingOut(false);
      if (err.code === "auth/requires-recent-login") {
        setDeleteError("Please logout and login again to delete your account for security.");
      } else {
        setDeleteError(getFirebaseErrorMessage(err));
      }
      setIsDeleting(false);
    }
  };

  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;

    setIsSendingSupport(true);
    try {
      // If you are getting an error about '@emailjs/browser', run 'npm install @emailjs/browser' in your terminal
      // REPLACE THESE PLACEHOLDERS WITH YOUR ACTUAL KEYS IF .env IS NOT WORKING
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID || "service_tmjpjj9";
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "template_m3kqumn";
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "C2niOJruVVawT47dK";

      if (!serviceId || serviceId === "YOUR_SERVICE_ID" || !publicKey || publicKey === "YOUR_PUBLIC_KEY") {
        throw new Error("EmailJS keys missing. Please paste your keys inside Settings.tsx or restart npm run dev to load .env variables.");
      }

      const templateParams = {
        name: profile?.name || user?.uid || "User",
        email: user?.email || "Unknown",
        time: new Date().toLocaleString(),
        message: supportMessage
      };

      const result = await emailjs.send(serviceId, templateId, templateParams, publicKey);

      if (result.status === 200) {
        alert("Message Sent Successfully! We will get back to you soon.");
        setSupportMessage("");
        setShowSupportModal(false);
      } else {
        throw new Error("Failed to send message via EmailJS");
      }
    } catch (error: any) {
      console.error("Support submission error:", error);
      alert(error.message || "Failed to send message. Please check console for details.");
    } finally {
      setIsSendingSupport(false);
    }
  };

  const settingsSections = [
    {
      id: "account",
      icon: <Key size={24} className="text-white/60" strokeWidth={1.5} />,
      title: t("Account"),
      subtitle: t("Security notifications"),
    },
    {
      id: "privacy",
      icon: <Lock size={24} className="text-white/60" strokeWidth={1.5} />,
      title: t("Privacy"),
      subtitle: t("Blocked contacts"),
    },
    {
      id: "language",
      icon: <Globe size={24} className="text-white/60" strokeWidth={1.5} />,
      title: t("App language"),
      subtitle: "English (device's language)",
    },
    {
      id: "help",
      icon: (
        <HelpCircle size={24} className="text-white/60" strokeWidth={1.5} />
      ),
      title: t("Help"),
      subtitle: "Help center, contact us, privacy policy",
    },
  ];

  const renderSectionContent = () => {
    switch(activeSection) {
      case "account":
        return (
          <div className="space-y-4 p-2">
            <div className="bg-white/2ded-2xl p-4 space-y-4">
              <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50">
                  <Mail size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] text-white/50">Email</span>
                  <span className="text-[16px] text-white">{user?.email || "No email available"}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50">
                  <Phone size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] text-white/50">Phone Number</span>
                  <span className="text-[16px] text-white">{user?.phoneNumber || "No phone available"}</span>
                </div>
              </div>
            </div>

            <div className="bg-white/2 rounded-2xl p-2 space-y-1">
              <div onClick={handleSecNotifToggle} className="flex items-center justify-between p-4 hover:bg-white/4 rounded-xl cursor-pointer transition-colors">
                <div className="flex items-center gap-4">
                   <ShieldAlert size={22} className="text-white/70" />
                   <div className="flex flex-col">
                      <span className="text-[16px] text-white">{t("Security notifications")}</span>
                      <span className="text-[14px] text-white/50 mt-1 max-w-55">{t("Get notified when your security code changes.")}</span>
                   </div>
                </div>
                <div className={`w-10 h-6 rounded-full relative transition-colors ${secNotif ? 'bg-primary' : 'bg-white/10'}`}>
                  <motion.div 
                    initial={false}
                    animate={{ x: secNotif ? 16 : 2 }} 
                    className="w-5 h-5 bg-[#0a0f1c] rounded-full absolute top-0.5" 
                  />
                </div>
              </div>

               <div className="flex items-center gap-4 p-4 hover:bg-white/4 rounded-xl cursor-default transition-colors">
                 <CheckCircle2 size={22} className="text-white/70" />
                 <div className="flex flex-col">
                   <span className="text-[16px] text-white">Two-step verification</span>
                   <span className="text-red-500 text-xs mt-1 font-bold uppercase tracking-widest">Not available</span>
                 </div>
               </div>
               <div className="flex items-center gap-4 p-4 hover:bg-white/4 rounded-xl cursor-default transition-colors">
                 <FileText size={22} className="text-white/70" />
                 <div className="flex flex-col">
                   <span className="text-[16px] text-white">Request account info</span>
                   <span className="text-red-500 text-xs mt-1 font-bold uppercase tracking-widest">Not available</span>
                 </div>
               </div>
            </div>

            <div className="bg-white/2 rounded-2xl p-2 space-y-1">
              <div 
                onClick={logout} 
                className="flex items-center gap-4 p-4 hover:bg-white/4 rounded-xl cursor-pointer transition-colors text-white"
              >
                <LogOut size={22} />
                <span className="text-[16px]">{t("Log Out")}</span>
              </div>
              <div 
                onClick={() => setShowDeleteModal(true)} 
                className="flex items-center gap-4 p-4 hover:bg-red-500/10 rounded-xl cursor-pointer transition-colors text-red-400"
              >
                <Trash2 size={22} />
                <span className="text-[16px]">{t("Delete account")}</span>
              </div>
            </div>
          </div>
        );
      case "profile":
        return (
          <div className="space-y-6 p-4">
            <div className="flex justify-center">
              <div
                className="relative w-32 h-32 group cursor-pointer"
                onClick={() => document.getElementById("edit-photo-upload")?.click()}
              >
                <img
                  src={photoURL || emojiToSVG(emoji)}
                  alt="Preview"
                  className="w-full h-full rounded-[2.5rem] shadow-xl border-4 border-white/10 group-hover:border-primary/50 transition-colors object-cover"
                />
                <div className="absolute -bottom-2 -right-2 bg-primary text-[#0f172a] p-2.5 rounded-2xl shadow-lg">
                  <Palette size={16} />
                </div>
                <input
                  id="edit-photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] ml-2">
                Your LinkUpply ID
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-primary font-bold tracking-widest">
                  {profile?.linkupId}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(profile?.linkupId || "");
                    alert("ID Copied!");
                  }}
                  className="p-4 bg-primary/10 text-primary rounded-2xl hover:bg-primary/20 transition"
                >
                  <Sparkles size={20} />
                </button>
              </div>
              <p className="text-[10px] text-white/20 ml-2 uppercase font-bold tracking-widest">
                Share this ID with friends to LinkUpply!
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] ml-2">
                {t("Display Name")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                dir="auto"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-white/20 font-medium"
                placeholder={t("Your name")}
              />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] ml-2">
                {t("Bio")}
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                dir="auto"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all h-32 resize-none font-medium placeholder:text-white/20"
                placeholder={t("Tell us about yourself...")}
              />
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] ml-2">
                Choose Avatar
              </label>
              <div className="grid grid-cols-5 gap-3">
                {emojis.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={`text-3xl p-3 rounded-2xl transition-all duration-300 ${emoji === e ? "bg-primary/20 border-primary border shadow-[0_0_15px_rgba(34,211,238,0.2)] scale-110" : "bg-white/5 border border-white/10 hover:bg-white/10"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSaveProfile}
              disabled={loadingProfile}
              className="w-full bg-primary text-[#0f172a] font-bold py-5 rounded-3xl shadow-2xl shadow-primary/20 disabled:opacity-50 text-lg tracking-tight mb-8"
            >
              {loadingProfile ? t("Saving Changes...") : t("Save Profile")}
            </motion.button>
          </div>
        );
      case "privacy":
        return (
          <div className="space-y-4 p-2">
            <div className="bg-white/2 rounded-2xl p-2 space-y-1 mt-2">
              <div onClick={handleReadReceiptsToggle} className="flex items-center justify-between p-4 hover:bg-white/4 rounded-xl cursor-pointer transition-colors">
                 <div className="flex flex-col">
                    <span className="text-[16px] text-white">{t("Read receipts")}</span>
                    <span className="text-[14px] text-white/50 mt-1 max-w-62.5">{t("If turned off, you won't send or receive read receipts.")}</span>
                 </div>
                 <div className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${readReceipts ? 'bg-primary' : 'bg-white/10'}`}>
                    <motion.div 
                      initial={false}
                      animate={{ x: readReceipts ? 16 : 2 }} 
                      className="w-5 h-5 bg-[#0a0f1c] rounded-full absolute top-0.5" 
                    />
                 </div>
              </div>
            </div>

            <div className="px-4 py-2 text-white/50 text-sm font-medium">{t("Blocked contacts")}</div>
            <div className="bg-white/2 rounded-2xl p-2 min-h-25">
              {blockedUsersInfo.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 opacity-50">
                   <UserX size={32} className="mb-2 text-white" />
                   <p className="text-sm text-white">{t("No blocked contacts")}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {blockedUsersInfo.map(u => (
                     <div key={u.id} className="flex items-center justify-between p-3 hover:bg-white/4 rounded-xl transition-colors">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden border border-white/10">
                              <img src={u.photoURL || emojiToSVG(u.emoji || '👤')} alt="" className="w-full h-full object-cover" />
                           </div>
                           <span className="text-white font-medium">{u.name}</span>
                        </div>
                        <button onClick={() => handleUnblock(u.id)} className="px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-white text-sm transition-colors">
                          {t("Unblock")}
                        </button>
                     </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      case "language":
        const languages = [
          { title: "English (device's language)", val: "en" },
          { title: "Urdu (اردو)", val: "ur" },
          { title: "Hindi (हिंदी)", val: "hi" },
          { title: "한국어", val: "ko" },
          { title: "中文", val: "zh" },
          { title: "Spanish (Español)", val: "es" },
        ];
        return (
          <div className="space-y-4 p-2 mt-2">
            <div className="bg-white/2 rounded-2xl p-2 space-y-1">
              {languages.map((item, idx) => (
                <div key={idx} onClick={() => handleLangSelect(item.val)} className="flex items-center justify-between p-4 hover:bg-white/4 rounded-xl cursor-pointer transition-colors">
                  <span className="text-[16px] text-white">{item.title}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${appLang === item.val ? 'border-primary' : 'border-white/20'}`}>
                    {appLang === item.val && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "help":
        return (
          <div className="space-y-4 p-2 mt-2">
             <div className="bg-linear-to-br from-primary/20 via-primary/5 to-transparent border border-primary/20 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                 <div className="w-14 h-14 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-4">
                     <HelpCircle size={32} />
                 </div>
                 <h3 className="text-lg font-medium text-white mb-2">{t("Need Assistance?")}</h3>
                 <p className="text-white/60 text-sm mb-4">{t("Our support team is always ready to help you with any issues.")}</p>
                 <button 
                   onClick={() => setShowSupportModal(true)}
                   className="px-6 py-2.5 bg-primary text-black font-medium rounded-full hover:bg-primary/90 transition-colors w-full"
                 >
                    {t("Contact Support")}
                 </button>
             </div>

             <div className="bg-white/2 rounded-2xl p-2 space-y-1 mt-4">
                 <div 
                   onClick={() => setShowTermsModal(true)}
                   className="flex items-center gap-4 p-4 hover:bg-white/4 rounded-xl cursor-pointer transition-colors text-white"
                 >
                   <div className="w-6 flex justify-center text-white/50"><FileText size={22} /></div>
                   <div className="flex flex-col">
                     <span className="text-[16px]">{t("Terms & Privacy Policy")}</span>
                   </div>
                 </div>
                 <div className="flex items-center gap-4 p-4 hover:bg-white/4 rounded-xl cursor-pointer transition-colors text-white">
                   <div className="w-6 flex justify-center text-white/50"><Smartphone size={22} /></div>
                   <div className="flex flex-col">
                     <span className="text-[16px]">{t("App info")}</span>
                     <span className="text-[14px] text-white/50">Version 1.0.0</span>
                   </div>
                 </div>
             </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="h-full w-full flex flex-col relative overflow-hidden"
    >
      <AnimatePresence mode="wait">
        {!activeSection ? (
          <motion.div
            key="main"
            initial={{ opacity: 0, x: "-50%" }}
            animate={{ opacity: 1, x: "0%" }}
            exit={{ opacity: 0, x: "-50%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="p-4 md:px-6 md:py-4 h-full overflow-y-auto custom-scrollbar flex flex-col w-full absolute inset-0 bg-[#0a0f1c] pb-24 md:pb-4"
          >
            <h2 className="text-2xl font-bold text-white tracking-tight mb-6 mt-2 shrink-0">{t("Settings")}</h2>
            <div 
               onClick={() => setActiveSection("profile")}
               className="flex items-center gap-4 mb-4 p-4 hover:bg-white/4 rounded-4xl cursor-pointer transition-colors active:bg-white/6 shrink-0"
            >
              <div className="w-18 h-18 shrink-0 rounded-full overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
                <img
                  src={profile?.photoURL || emojiToSVG(profile?.emoji || "😀")}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[20px] font-medium text-white truncate">
                  {profile?.name}
                </h2>
                <p className="text-[15px] text-white/50 truncate font-light mt-0.5">
                  {profile?.bio}
                </p>
              </div>
            </div>

            <div className="space-y-0 pb-12 mt-2">
              {settingsSections.map((section) => (
                <div
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className="flex items-center gap-6 p-4 hover:bg-white/4 rounded-2xl cursor-pointer transition-colors active:bg-white/8"
                >
                  <div className="w-6 shrink-0 flex justify-center text-white/50">
                    {section.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-normal text-white mb-0.5">
                      {section.title}
                    </h3>
                    {section.subtitle && (
                      <p className="text-[14px] text-white/40 font-light">
                        {section.subtitle}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: "50%" }}
            animate={{ opacity: 1, x: "0%" }}
            exit={{ opacity: 0, x: "50%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-0 bg-[#0a0f1c] z-10 flex flex-col overflow-y-auto custom-scrollbar pb-24 md:pb-4"
          >
            <div className="flex items-center gap-4 p-4 sticky top-0 bg-[#0a0f1c]/80 backdrop-blur-md z-20 shrink-0 border-b border-white/5">
              <button
                onClick={() => setActiveSection(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
              >
                <ArrowLeft size={24} />
              </button>
              <h2 className="text-xl font-medium text-white capitalize">
                {activeSection.replace("-", " ")}
              </h2>
            </div>
            <div className="flex-1 p-2">
              {renderSectionContent()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSupportModal && (
          <div className="fixed inset-0 z-300 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
              onClick={() => setShowSupportModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg glass-morphism rounded-[3rem] p-8 md:p-10 border border-white/10 shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-white">Contact Support</h2>
                <button 
                  onClick={() => setShowSupportModal(false)}
                  className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSendSupport} className="space-y-6">
                <div className="space-y-2 text-center md:text-left">
                  <p className="text-white/40 text-sm font-medium">
                    Please describe the issue or feedback you have. Our team will get back to your email ({user?.email}) as soon as possible.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] ml-2">
                    Message
                  </label>
                  <textarea
                    required
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Type your message here..."
                    className="w-full bg-white/5 border border-white/10 rounded-4xl p-6 text-white outline-none focus:border-primary transition-all font-medium h-48 resize-none text-[16px]"
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSendingSupport || !supportMessage.trim()}
                  className="w-full bg-primary text-[#0f172a] font-bold py-5 rounded-3xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50 text-lg sm:text-xl transition-all"
                >
                  {isSendingSupport ? (
                    <>
                      <div className="w-5 h-5 border-2 border-[#0f172a] border-t-transparent rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      <span>Send Message</span>
                    </>
                  )}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTermsModal && (
          <div className="fixed inset-0 z-300 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
              onClick={() => setShowTermsModal(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-2xl bg-[#0a0f1c] h-full sm:h-[90vh] sm:rounded-[3rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="sticky top-0 bg-[#0a0f1c]/80 backdrop-blur-xl z-20 flex items-center justify-between px-8 py-6 border-b border-white/5">
                <h2 className="text-xl font-bold text-white tracking-tight uppercase">Privacy & Terms</h2>
                <button 
                  onClick={() => setShowTermsModal(false)}
                  className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12 custom-scrollbar">
                <section>
                  <h3 className="text-2xl font-bold text-primary mb-6">Terms of Service</h3>
                  <div className="space-y-6 text-white/70 leading-relaxed font-light">
                    <p>Welcome to LinkUpply! By using our platform, you agree to these legal terms designed to keep our community safe and secure.</p>
                    
                    <div className="space-y-4">
                      <h4 className="text-white font-bold uppercase tracking-widest text-sm">1. Acceptance of Terms</h4>
                      <p>By accessing or using the LinkUpply application, you agree to be bound by these Terms of Service. If you do not agree, please do not use the application.</p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-white font-bold uppercase tracking-widest text-sm">2. User Conduct</h4>
                      <p>You are solely responsible for your communication. Harassment, illegal activities, and the spread of malicious software are strictly prohibited and will result in permanent account termination.</p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-white font-bold uppercase tracking-widest text-sm">3. Account Security</h4>
                      <p>You are responsible for maintaining the confidentiality of your account credentials. LinkUpply uses Firebase Authentication to ensure industry-standard security for your login data.</p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-white font-bold uppercase tracking-widest text-sm">4. Modifications</h4>
                      <p>LinkUpply reserves the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>
                    </div>
                  </div>
                </section>

                <div className="w-full h-px bg-white/5 my-8"></div>

                <section className="pb-12">
                  <h3 className="text-2xl font-bold text-secondary mb-6">Privacy Policy</h3>
                  <div className="space-y-6 text-white/70 leading-relaxed font-light">
                    <div className="bg-secondary/10 border border-secondary/20 p-6 rounded-3xl mb-8">
                       <h4 className="text-secondary font-bold uppercase tracking-widest text-xs mb-2">Our Commitment</h4>
                       <p className="text-white">LinkUpply is built with privacy as a foundational principle. We leverage modern cloud technologies and end-to-end encryption architectural patterns to protect your conversations.</p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-white font-bold uppercase tracking-widest text-sm">1. Data Collection</h4>
                      <p>We collect minimal data required to provide our services: your email, display name, and profile bio. We do not sell your personal data to third parties.</p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-white font-bold uppercase tracking-widest text-sm">2. End-to-End Encryption</h4>
                      <p>Your messages are designed to be encrypted. While stored on secure Firestore servers, the content is accessible only by the intended recipients. LinkUpply administrators cannot read your private chats.</p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-white font-bold uppercase tracking-widest text-sm">3. Multimedia & Analytics</h4>
                      <p>Media files uploaded to LinkUpply are stored in secure cloud storage buckets. We may collect anonymous usage statistics to improve application performance and stability.</p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-white font-bold uppercase tracking-widest text-sm">4. Your Rights</h4>
                      <p>You have the right to delete your account and all associated data at any time through the Settings menu. This action is permanent and erases your presence from our database.</p>
                    </div>
                  </div>
                </section>
              </div>

              <div className="p-8 border-t border-white/5 bg-[#0a0f1c]/50">
                 <button 
                   onClick={() => setShowTermsModal(false)}
                   className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition"
                 >
                   I Understand
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-300 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
              onClick={() => setShowDeleteModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md glass-morphism rounded-[3rem] p-8 md:p-10 border border-red-500/20 shadow-2xl"
            >
              <div className="w-20 h-20 bg-red-500/20 rounded-4xl flex items-center justify-center text-red-500 mx-auto mb-6 shadow-lg shadow-red-500/20">
                <Trash size={40} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-2">
                Delete Account?
              </h2>
              <p className="text-white/40 text-center mb-8 text-sm md:text-base font-medium">
                This action is permanent and cannot be undone. All your messages and
                profile data will be erased.
              </p>

              {!isGoogle && (
                <div className="space-y-2 mb-6">
                  <label className="block text-xs font-bold text-white/30 uppercase tracking-widest ml-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-red-500 outline-none transition font-bold"
                  />
                </div>
              )}

              {deleteError && (
                <p className="text-red-400 text-xs text-center font-bold bg-red-400/10 py-3 rounded-xl border border-red-400/20 mb-6">
                  {deleteError}
                </p>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="w-full py-4 md:py-5 bg-red-500 text-white font-bold rounded-2xl shadow-xl shadow-red-500/20 hover:brightness-110 transition disabled:opacity-50"
                >
                  {isDeleting
                    ? "Deleting..."
                    : isGoogle
                      ? "Confirm with Google"
                      : "Delete Permanently"}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="w-full py-4 md:py-5 text-white/40 font-bold hover:text-white transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}