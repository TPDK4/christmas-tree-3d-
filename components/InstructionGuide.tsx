import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

export const InstructionGuide: React.FC = () => {
  const { t } = useLanguage();
  // Strictly closed (minimized) by default on ALL devices on entry
  const [isMinimized, setIsMinimized] = useState<boolean>(true);

  const handleToggle = (minimized: boolean) => {
    setIsMinimized(minimized);
  };

  return (
    <>
      {/* Floating button at top-left when minimized */}
      <div className="fixed top-3 left-3 sm:top-6 sm:left-6 md:top-8 md:left-8 z-40 flex flex-col items-start pointer-events-none select-none">
        {isMinimized && (
          <button
            onClick={() => handleToggle(false)}
            className="pointer-events-auto group flex items-center justify-center gap-2 p-2 sm:px-3 sm:py-2 rounded-xl border border-[#D4AF37]/70 bg-black/85 hover:bg-[#D4AF37]/25 backdrop-blur-md shadow-[0_0_15px_rgba(212,175,55,0.25)] text-[#F5E6BF] hover:text-white transition-all cursor-pointer active:scale-95"
            title={t('guideOpenBtn')}
            aria-label="Menu hướng dẫn"
          >
            {/* 3 horizontal bars (Hamburger icon ☰) */}
            <div className="flex flex-col justify-center items-center gap-1 w-4 h-4">
              <span className="block w-4 h-0.5 bg-[#D4AF37] group-hover:bg-white rounded-full transition-colors"></span>
              <span className="block w-4 h-0.5 bg-[#D4AF37] group-hover:bg-white rounded-full transition-colors"></span>
              <span className="block w-4 h-0.5 bg-[#D4AF37] group-hover:bg-white rounded-full transition-colors"></span>
            </div>

            {/* Desktop label */}
            <span className="hidden sm:inline font-sans text-xs font-semibold tracking-wide">
              {t('guideOpenBtn')}
            </span>
          </button>
        )}
      </div>

      {/* Centered Modal with full backdrop overlay when opened */}
      {!isMinimized && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pointer-events-auto"
          onClick={() => handleToggle(true)}
        >
          {/* Centered Instruction Card */}
          <div
            className="w-full max-w-[360px] max-h-[88vh] overflow-y-auto custom-scrollbar p-4 sm:p-5 rounded-2xl bg-black/95 border-2 border-[#D4AF37] shadow-[0_0_35px_rgba(212,175,55,0.4)] text-[#F5E6BF] font-sans flex flex-col pointer-events-auto animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#D4AF37]/30">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="block w-3.5 h-0.5 bg-[#D4AF37] rounded-full"></span>
                  <span className="block w-3.5 h-0.5 bg-[#D4AF37] rounded-full"></span>
                  <span className="block w-3.5 h-0.5 bg-[#D4AF37] rounded-full"></span>
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#F5E6BF]">
                  {t('guideTitle')}
                </h2>
              </div>

              {/* Close "✕" Button */}
              <button
                onClick={() => handleToggle(true)}
                title={t('guideCloseBtn')}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/20 text-[#D4AF37] hover:text-white border border-[#D4AF37]/30 hover:border-[#D4AF37] transition-all cursor-pointer active:scale-90"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
                </svg>
              </button>
            </div>

            {/* Section 0: Touch Controls (Phone & Tablet friendly) */}
            <div className="mb-3 p-2.5 rounded-xl bg-amber-950/25 border border-amber-500/25">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">👆</span>
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  {t('touchGuideTitle')}
                </span>
              </div>
              <div className="space-y-1 text-xs text-gray-200">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px]">
                  <span>🔄</span>
                  <span>{t('touchRotate')}</span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px]">
                  <span>🔍</span>
                  <span>{t('touchZoom')}</span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px]">
                  <span>🖼️</span>
                  <span>{t('touchTapPhoto')}</span>
                </div>
              </div>
            </div>

            {/* Section 1: Single-hand Gesture - Tree Control (Pinch) */}
            <div className="mb-3 p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/25">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🌲</span>
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    {t('handSingleTitle')}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-gray-200">
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10 h-9">
                  <span className="text-gray-300 font-medium">🤏 {t('treePinchClose')}:</span>
                  <span className="font-semibold text-emerald-400">{t('formTree')}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10 h-9">
                  <span className="text-gray-300 font-medium">🖐 {t('treePinchOpen')}:</span>
                  <span className="font-semibold text-amber-300">{t('unleashTree')}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10 h-9">
                  <span className="text-gray-300 font-medium">✋ {t('moveTree')}:</span>
                  <span className="font-semibold text-[#F5E6BF]">{t('statusRotate')}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Photo Selection (1 - 5 fingers) */}
            <div className="mb-3 p-3 rounded-xl bg-sky-950/30 border border-sky-500/25">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📸</span>
                  <span className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                    {t('handLeftPhoto')}
                  </span>
                </div>
                <span className="text-[11px] text-sky-400/90 font-mono bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded-full">
                  {t('photoFingersHint')}
                </span>
              </div>
              
              {/* 2x3 Grid */}
              <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-200">
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-sky-400/30 transition-colors h-8 whitespace-nowrap">
                  <span>☝️ 1:</span>
                  <span className="font-semibold text-[#38BDF8]">{t('photoFinger1')}</span>
                </div>
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-sky-400/30 transition-colors h-8 whitespace-nowrap">
                  <span>✌️ 2:</span>
                  <span className="font-semibold text-[#38BDF8]">{t('photoFinger2')}</span>
                </div>
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-sky-400/30 transition-colors h-8 whitespace-nowrap">
                  <span>🤟 3:</span>
                  <span className="font-semibold text-[#38BDF8]">{t('photoFinger3')}</span>
                </div>
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-sky-400/30 transition-colors h-8 whitespace-nowrap">
                  <span>🖖 4:</span>
                  <span className="font-semibold text-[#38BDF8]">{t('photoFinger4')}</span>
                </div>
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-sky-400/30 transition-colors h-8 whitespace-nowrap">
                  <span>🖐 5:</span>
                  <span className="font-semibold text-[#38BDF8]">{t('photoFinger5')}</span>
                </div>
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-amber-400/30 transition-colors h-8 whitespace-nowrap">
                  <span>✊:</span>
                  <span className="font-semibold text-amber-300">{t('fistPhotoClose')}</span>
                </div>
              </div>
            </div>

            {/* Prominent Golden Close Button at Bottom */}
            <button
              onClick={() => handleToggle(true)}
              className="mt-1 w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-[#D4AF37] via-[#F5E6BF] to-[#D4AF37] hover:brightness-110 shadow-[0_0_15px_rgba(212,175,55,0.35)] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>✕</span>
              <span>{t('guideCloseBtn')}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
