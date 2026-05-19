import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../store';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, updateDoc, collection, addDoc, getDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { emojiToSVG } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

// A simple base64 repeating beep sound for ringtone
const ringtoneDataURI = "data:audio/wav;base64,UklGRqgAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YYQAAAAA/wD/AP8A/wD/AP8A/wD/AIAAAAD/AP8A/wD/AP8A/wD/AP8AAIAAAAD/AP8A/wD/AP8A/wD/AP8AAIAAAAD/AP8A/wD/AP8A/wD/AP8AAIAAAAD/AP8A/wD/AP8A/wD/AP8AAIAAAAD/AP8A/wD/AP8A/wD/AP8AAIAAAAD/AP8A/wD/AP8A/wD/AP8AAIAAAAD/AP8A/wD/AP8A/wD/AP8AAIAAAAD/AP8A/wD/AP8A/wD/AP8A=";

export function CallScreen({ contact, type, isIncoming, callId, onEnd }: { contact: any, type: 'voice' | 'video', isIncoming: boolean, callId: string, onEnd: () => void }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<'calling' | 'ringing' | 'ongoing' | 'ended'>(isIncoming ? 'ringing' : 'calling');
  const [hasAccepted, setHasAccepted] = useState(!isIncoming);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(type === 'voice');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Handle incoming call ringing state & listening for caller hangup
  useEffect(() => {
    if (!user || hasAccepted) return;

    if (isIncoming) {
      // Play ringing sound
      const audio = new Audio(ringtoneDataURI);
      audio.loop = true;
      audio.play().catch(e => console.log('Audio autoplay blocked', e));
      audioRef.current = audio;

      // Listen for caller hangup
      const callDoc = doc(db, 'calls', callId);
      const unsub = onSnapshot(callDoc, (snapshot) => {
        const data = snapshot.data();
        if (!snapshot.exists() || data?.status === 'ended' || data?.status === 'rejected') {
          handleEndCall();
        }
      });

      return () => {
        unsub();
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      };
    }
  }, [isIncoming, hasAccepted, user, callId]);

  // Handle WebRTC Setup (once accepted or calling)
  useEffect(() => {
    if (!user || !hasAccepted) return;

    const setupCall = async () => {
      // Play outgoing ringing if we are calling
      if (!isIncoming) {
        const audio = new Audio(ringtoneDataURI);
        audio.loop = true;
        audio.play().catch(e => console.log('Audio autoplay blocked', e));
        audioRef.current = audio;
      }

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Media devices not supported in this browser/environment");
        }
        
        if (window.hasOwnProperty('Capacitor')) {
          const { requestMediaPermissions } = await import('../services/notificationService');
          await requestMediaPermissions(type);
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: type === 'video',
          audio: true
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Error accessing media devices", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          alert("Please allow camera and microphone permissions to make calls.");
        } else {
          alert("Could not access camera or microphone. Please check your settings.");
        }
        handleEndCall();
        return;
      }

      const servers = {
        iceServers: [
          { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
          { urls: ['stun:global.stun.twilio.com:3478'] },
          { urls: ['stun:stun.l.google.com:19302'] }
        ]
      };
      const pc = new RTCPeerConnection(servers);
      pcRef.current = pc;

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          handleEndCall();
        }
      };

      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      const callDoc = doc(db, 'calls', callId);
      const offerCandidates = collection(callDoc, 'callerCandidates');
      const answerCandidates = collection(callDoc, 'calleeCandidates');

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(isIncoming ? answerCandidates : offerCandidates, {
            candidate: event.candidate.toJSON()
          });
        }
      };

      if (!isIncoming) {
        // Caller creates offer
        const offerDescription = await pc.createOffer();
        await pc.setLocalDescription(offerDescription);

        const offer = {
          sdp: offerDescription.sdp,
          type: offerDescription.type,
        };

        await setDoc(callDoc, {
          callerId: user.uid,
          calleeId: contact.id,
          type,
          status: 'calling',
          offer,
          timestamp: serverTimestamp()
        });

        onSnapshot(callDoc, (snapshot) => {
          const data = snapshot.data();
          if (!snapshot.exists() || data?.status === 'ended' || data?.status === 'rejected') {
            handleEndCall();
            return;
          }
          if (!pc.currentRemoteDescription && data?.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            pc.setRemoteDescription(answerDescription).then(() => {
              setStatus('ongoing');
              stopRingtone();
              
              if ((pc as any).pendingCandidates) {
                (pc as any).pendingCandidates.forEach((candidate: any) => {
                  pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding pending candidate", e));
                });
                (pc as any).pendingCandidates = [];
              }
            });
          }
        });

        onSnapshot(answerCandidates, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (pc.remoteDescription) {
                pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } else {
                (pc as any).pendingCandidates = (pc as any).pendingCandidates || [];
                (pc as any).pendingCandidates.push(data.candidate);
              }
            }
          });
        });

      } else {
        // Callee answers
        const callData = (await getDoc(callDoc)).data();
        if (!callData?.offer) {
           handleEndCall();
           return;
        }

        const offerDescription = new RTCSessionDescription(callData.offer);
        await pc.setRemoteDescription(offerDescription);

        const answerDescription = await pc.createAnswer();
        await pc.setLocalDescription(answerDescription);

        const answer = {
          type: answerDescription.type,
          sdp: answerDescription.sdp,
        };

        await updateDoc(callDoc, { answer, status: 'ongoing' });
        setStatus('ongoing');
        stopRingtone();

        onSnapshot(callDoc, async (snapshot) => {
          const data = snapshot.data();
          if (!snapshot.exists() || data?.status === 'ended') {
            handleEndCall();
          }
        });

        onSnapshot(offerCandidates, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (pc.remoteDescription) {
                pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } else {
                (pc as any).pendingCandidates = (pc as any).pendingCandidates || [];
                (pc as any).pendingCandidates.push(data.candidate);
              }
            }
          });
        });
        
        // Add any pending candidates after remote description is set
        if ((pc as any).pendingCandidates) {
          (pc as any).pendingCandidates.forEach((candidate: any) => {
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding pending candidate", e));
          });
          (pc as any).pendingCandidates = [];
        }
      }
    };

    setupCall();

    return () => {
      stopRingtone();
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      pcRef.current?.close();
    };
  }, [user, hasAccepted]);

  const stopRingtone = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const handleAccept = async () => {
    stopRingtone();
    setHasAccepted(true);
  };

  const handleEndCall = async () => {
    stopRingtone();
    setStatus('ended');
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    pcRef.current?.close();
    
    if (user) {
      try {
        await deleteDoc(doc(db, 'calls', callId));
      } catch (e) {}
    }
    onEnd();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current && type === 'video') {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  // Render Incoming Call Overlay if not yet accepted
  if (isIncoming && !hasAccepted) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-200 bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-center text-white p-4"
      >
        <motion.div
           animate={{ scale: [1, 1.05, 1] }}
           transition={{ repeat: Infinity, duration: 1.5 }}
           className="w-32 h-32 md:w-40 md:h-40 rounded-full mb-8 relative"
        >
          <div className="absolute inset-0 rounded-full shadow-[0_0_40px_rgba(34,211,238,0.4)] animate-pulse" />
          <img src={contact.photoURL || emojiToSVG(contact.emoji)} alt={contact.name} className="w-full h-full object-cover rounded-full border-4 border-primary/50 relative z-10" />
        </motion.div>
        <h2 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight text-center">{contact.name}</h2>
        <p className="text-white/60 mb-16 text-sm md:text-lg tracking-wider">Incoming {type} call...</p>

        <div className="flex gap-10 md:gap-16">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleEndCall} 
            className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-red-500 flex flex-col items-center justify-center text-white shadow-[0_0_30px_rgba(239,68,68,0.4)]"
          >
            <PhoneOff size={28} />
          </motion.button>
          
          <motion.button 
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleAccept} 
            className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-green-500 flex flex-col items-center justify-center text-white shadow-[0_0_30px_rgba(34,197,94,0.4)]"
          >
            <Phone size={28} className="animate-pulse" />
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-150 bg-black flex flex-col text-white"
    >
      {/* Video Elements */}
      {type === 'video' && (
        <div className="flex-1 relative bg-black">
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
          <motion.video 
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="absolute top-4 right-4 w-28 h-40 bg-zinc-900 object-cover rounded-2xl border-2 border-primary/20 shadow-2xl z-10"
          />
        </div>
      )}

      {/* Voice Call UI */}
      {type === 'voice' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 bg-linear-to-b from-[#0f172a] to-black p-4 text-center">
          <motion.div
            animate={status === 'ongoing' ? {} : { 
              scale: [1, 1.05, 1],
              boxShadow: [
                "0 0 0 0px rgba(99, 102, 241, 0)",
                "0 0 0 20px rgba(99, 102, 241, 0.1)",
                "0 0 0 0px rgba(99, 102, 241, 0)"
              ]
            }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <img src={contact.photoURL || emojiToSVG(contact.emoji)} alt={contact.name} className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover shadow-[0_0_50px_rgba(34,211,238,0.2)] border-2 border-primary/50" />
          </motion.div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{contact.name}</h2>
            <p className="text-primary font-bold uppercase tracking-widest text-xs mt-3 opacity-80">{status}...</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="p-6 md:p-8 pb-10 md:pb-12 flex items-center justify-center gap-4 md:gap-6 bg-linear-to-t from-black/90 to-transparent absolute bottom-0 w-full backdrop-blur-sm z-50">
        <div className="flex gap-4 items-center">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={toggleMute} 
            className={`w-14 h-14 md:w-16 md:h-16 rounded-3xl flex items-center justify-center transition-all ${isMuted ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md'}`}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </motion.button>
          
          {type === 'video' && (
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={toggleVideo} 
              className={`w-14 h-14 md:w-16 md:h-16 rounded-3xl flex items-center justify-center transition-all ${isVideoOff ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md'}`}
            >
              {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
            </motion.button>
          )}

          <motion.button 
            whileHover={{ scale: 1.1, rotate: 135 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleEndCall} 
            className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-red-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] md:ml-8 ml-4"
          >
            <PhoneOff size={28} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
