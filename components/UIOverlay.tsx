import React from 'react';
import { TreeMode, ActiveTrack, MaskType } from '../types';

interface UIOverlayProps {
  mode?: TreeMode;
  onToggle?: () => void;
  onPhotosUpload?: (photos: string[]) => void;
  hasPhotos?: boolean;
  uploadedPhotos?: string[];
  isSharedView?: boolean;
  currentMask?: MaskType;
  currentMusic?: ActiveTrack | null;
}

export const UIOverlay: React.FC<UIOverlayProps> = () => {
  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
      {/* Header - Placed cleanly below top buttons on mobile (top-[88px]) and at top on desktop (sm:top-5 md:top-7) */}
      <header className="absolute top-[88px] sm:top-5 md:top-7 left-1/2 transform -translate-x-1/2 flex flex-col items-center pointer-events-none select-none z-20 w-full px-4">
        <h1 className="text-lg sm:text-2xl md:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F5E6BF] to-[#D4AF37] font-serif drop-shadow-[0_4px_16px_rgba(212,175,55,0.4)] tracking-wider text-center whitespace-nowrap px-2 sm:px-6 pt-0.5 sm:pt-2 pb-1 sm:pb-4 leading-normal">
          Merry Christmas
        </h1>
      </header>
    </div>
  );
};
