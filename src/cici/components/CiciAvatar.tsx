import React, { useState } from 'react';

interface CiciAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showStatus?: boolean;
}

export const CiciAvatar: React.FC<CiciAvatarProps> = ({
  size = 'sm',
  className = '',
  showStatus = false,
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses: Record<string, string> = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-9 h-9 text-base',
    xl: 'w-11 h-11 text-lg',
  };

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${sizeClasses[size] || sizeClasses.sm} rounded-full overflow-hidden bg-slate-900 border border-slate-700/80 text-white flex items-center justify-center font-bold font-mono shadow-xs select-none`}
      >
        {!imgError ? (
          <img
            src="/cici-avatar.png"
            alt="Cici: Asisten NSM"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-[center_20%] scale-135 transition-transform duration-200"
          />
        ) : (
          <span>C</span>
        )}
      </div>
      {showStatus && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-slate-900"></span>
        </span>
      )}
    </div>
  );
};
