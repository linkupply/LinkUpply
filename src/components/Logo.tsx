import React from 'react';

export function Logo({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <div className={`${className} relative flex items-center justify-center`}>
      <img 
        src="/logo.png" 
        alt="LinkUpply Logo" 
        className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
