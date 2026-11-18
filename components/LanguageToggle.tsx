import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export const LanguageToggle: React.FC = () => {
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      title={t('langTooltip')}
      className="group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#D4AF37]/50 bg-black/85 hover:bg-[#D4AF37]/20 text-[#D4AF37] hover:text-[#F5E6BF] backdrop-blur-md shadow-[0_0_10px_rgba(0,0,0,0.5)] hover:shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-all duration-300 cursor-pointer select-none font-sans"
    >
      <span className="text-sm">
        {language === 'vi' ? '🇻🇳' : '🇬🇧'}
      </span>
      <span className="text-xs font-bold tracking-wider">
        {language === 'vi' ? 'VI' : 'EN'}
      </span>
      <span className="text-[10px] text-[#D4AF37]/60 group-hover:text-[#F5E6BF]/80 transition-colors">
        ⇄
      </span>
    </button>
  );
};
