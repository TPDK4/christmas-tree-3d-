import React from 'react';

export type MaskType = 'none' | 'santa' | 'reindeer' | 'snowman' | 'masquerade' | 'cool' | 'cat' | 'blur';

export interface MaskOption {
  id: MaskType;
  label: string;
  emoji: string;
  desc: string;
}

export interface MaskMetrics {
  widthMultiplier: number;
  heightMultiplier: number;
  yOffsetPct: number; // Vertical offset relative to face height (e.g. -0.1 to lift hat onto forehead)
}

export const MASK_METRICS: Record<MaskType, MaskMetrics> = {
  none: { widthMultiplier: 1.0, heightMultiplier: 1.0, yOffsetPct: 0 },
  santa: { widthMultiplier: 2.1, heightMultiplier: 2.2, yOffsetPct: -0.06 },
  reindeer: { widthMultiplier: 2.2, heightMultiplier: 2.0, yOffsetPct: -0.15 },
  snowman: { widthMultiplier: 2.1, heightMultiplier: 2.1, yOffsetPct: -0.12 },
  masquerade: { widthMultiplier: 1.7, heightMultiplier: 1.3, yOffsetPct: -0.08 },
  cool: { widthMultiplier: 1.6, heightMultiplier: 1.4, yOffsetPct: 0.02 },
  cat: { widthMultiplier: 2.0, heightMultiplier: 1.8, yOffsetPct: -0.10 },
  blur: { widthMultiplier: 1.4, heightMultiplier: 1.4, yOffsetPct: 0 },
};

export const MASK_OPTIONS: MaskOption[] = [
  { id: 'none', label: 'Không dùng', emoji: '🚫', desc: 'Hiển thị mặt thật' },
  { id: 'santa', label: 'Ông già Noel', emoji: '🎅', desc: 'Mũ Noel & Râu trắng' },
  { id: 'reindeer', label: 'Tuần lộc', emoji: '🦌', desc: 'Sừng hươu & Mũi đỏ' },
  { id: 'snowman', label: 'Người tuyết', emoji: '⛄', desc: 'Mũ chóp & Mũi cà rốt' },
  { id: 'masquerade', label: 'Dạ hội hoàng gia', emoji: '🎭', desc: 'Mặt nạ vàng đen quý phái' },
  { id: 'cool', label: 'Kính ngầu', emoji: '😎', desc: 'Kính râm & Ria mép' },
  { id: 'cat', label: 'Mèo Noel', emoji: '🐱', desc: 'Tai mèo & Râu đáng yêu' },
  { id: 'blur', label: 'Che mờ ẩn danh', emoji: '🌫️', desc: 'Làm mờ mặt bảo mật' },
];

export const FaceMaskRenderer: React.FC<{ mask: MaskType }> = ({ mask }) => {
  switch (mask) {
    case 'santa':
      return (
        <svg viewBox="0 0 200 240" className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
          {/* Santa Hat */}
          <g>
            {/* Red Hat Cone */}
            <path
              d="M 40 70 Q 100 -10 160 70 C 140 30 180 30 185 85 Z"
              fill="#DC2626"
            />
            {/* White Pom-pom */}
            <circle cx="185" cy="85" r="16" fill="#FFFFFF" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))" />
            <circle cx="183" cy="83" r="14" fill="#F1F5F9" />
            
            {/* White Hat Fur Band */}
            <rect x="30" y="62" width="140" height="26" rx="13" fill="#FFFFFF" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.25))" />
            <rect x="35" y="65" width="130" height="20" rx="10" fill="#F8FAFC" />
          </g>

          {/* Rosy Cheeks */}
          <ellipse cx="60" cy="115" rx="14" ry="9" fill="#FB7185" opacity="0.6" />
          <ellipse cx="140" cy="115" rx="14" ry="9" fill="#FB7185" opacity="0.6" />

          {/* Cute Nose */}
          <ellipse cx="100" cy="112" rx="11" ry="8" fill="#FCA5A5" />

          {/* Big White Beard */}
          <path
            d="M 38 105 
               C 20 150 40 220 100 235 
               C 160 220 180 150 162 105 
               C 150 135 130 145 100 145 
               C 70 145 50 135 38 105 Z"
            fill="#FFFFFF"
            filter="drop-shadow(0 6px 12px rgba(0,0,0,0.3))"
          />

          {/* Handlebar Mustache */}
          <path
            d="M 100 120 
               C 85 105 50 115 45 135 
               C 65 145 90 135 100 128
               C 110 135 135 145 155 135 
               C 150 115 115 105 100 120 Z"
            fill="#F8FAFC"
            filter="drop-shadow(0 3px 5px rgba(0,0,0,0.2))"
          />
        </svg>
      );

    case 'reindeer':
      return (
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
          {/* Antlers Left */}
          <g fill="#78350F" stroke="#451A03" strokeWidth="2">
            <path d="M 65 75 Q 40 40 30 15 Q 45 25 50 38 Q 45 15 60 5 Q 60 25 70 48 Q 80 25 90 20 Q 80 40 78 72 Z" />
          </g>
          {/* Antlers Right */}
          <g fill="#78350F" stroke="#451A03" strokeWidth="2">
            <path d="M 135 75 Q 160 40 170 15 Q 155 25 150 38 Q 155 15 140 5 Q 140 25 130 48 Q 120 25 110 20 Q 120 40 122 72 Z" />
          </g>

          {/* Deer Ears */}
          <ellipse cx="42" cy="85" rx="18" ry="10" transform="rotate(-30 42 85)" fill="#92400E" />
          <ellipse cx="42" cy="85" rx="12" ry="6" transform="rotate(-30 42 85)" fill="#F472B6" />
          <ellipse cx="158" cy="85" rx="18" ry="10" transform="rotate(30 158 85)" fill="#92400E" />
          <ellipse cx="158" cy="85" rx="12" ry="6" transform="rotate(30 158 85)" fill="#F472B6" />

          {/* Forehead Fur Band with Christmas Holly */}
          <rect x="68" y="72" width="64" height="12" rx="6" fill="#B45309" />
          <circle cx="95" cy="74" r="4" fill="#DC2626" />
          <circle cx="105" cy="74" r="4" fill="#DC2626" />
          <circle cx="100" cy="70" r="4" fill="#DC2626" />

          {/* Big Glowing Red Nose */}
          <circle cx="100" cy="125" r="22" fill="#DC2626" filter="drop-shadow(0 0 14px #EF4444)" />
          <circle cx="100" cy="125" r="18" fill="#EF4444" />
          <ellipse cx="94" cy="118" rx="6" ry="4" fill="#FFFFFF" opacity="0.8" />
        </svg>
      );

    case 'snowman':
      return (
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
          {/* Top Hat */}
          <g>
            {/* Hat Brim */}
            <ellipse cx="100" cy="65" rx="65" ry="14" fill="#0F172A" />
            {/* Hat Crown */}
            <path d="M 60 62 L 68 15 L 132 15 L 140 62 Z" fill="#1E293B" />
            <ellipse cx="100" cy="15" rx="32" ry="8" fill="#334155" />
            {/* Hat Ribbon */}
            <path d="M 62 50 L 64 62 L 136 62 L 138 50 Z" fill="#DC2626" />
            {/* Gold Buckle / Holly */}
            <rect x="94" y="48" width="12" height="14" rx="2" fill="#D4AF37" stroke="#FEF08A" strokeWidth="1" />
          </g>

          {/* Rosy Cheeks */}
          <circle cx="58" cy="120" r="12" fill="#FB7185" opacity="0.6" />
          <circle cx="142" cy="120" r="12" fill="#FB7185" opacity="0.6" />

          {/* Carrot Nose pointing right */}
          <polygon points="95,110 155,122 95,124" fill="#EA580C" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))" />
          <line x1="108" y1="113" x2="107" y2="122" stroke="#9A3412" strokeWidth="1.5" />
          <line x1="124" y1="116" x2="123" y2="122" stroke="#9A3412" strokeWidth="1.5" />

          {/* Coal Smile */}
          <circle cx="72" cy="142" r="4" fill="#0F172A" />
          <circle cx="85" cy="150" r="4.5" fill="#0F172A" />
          <circle cx="100" cy="153" r="4.5" fill="#0F172A" />
          <circle cx="115" cy="150" r="4.5" fill="#0F172A" />
          <circle cx="128" cy="142" r="4" fill="#0F172A" />
        </svg>
      );

    case 'masquerade':
      return (
        <svg viewBox="0 0 200 140" className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]">
          <defs>
            <linearGradient id="goldMaskGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F5E6BF" />
              <stop offset="50%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#AA7C11" />
            </linearGradient>
          </defs>
          
          {/* Mask Base Wings */}
          <path
            d="M 100 70 
               C 85 55 60 40 25 45 
               C 5 48 5 95 35 110 
               C 65 125 85 95 100 80
               C 115 95 135 125 165 110
               C 195 95 195 48 175 45
               C 140 40 115 55 100 70 Z"
            fill="#09090B"
            stroke="url(#goldMaskGrad)"
            strokeWidth="3.5"
          />

          {/* Left Eye Cutout */}
          <path
            d="M 45 76 Q 65 60 85 76 Q 65 92 45 76 Z"
            fill="#000000"
            stroke="url(#goldMaskGrad)"
            strokeWidth="2"
          />

          {/* Right Eye Cutout */}
          <path
            d="M 115 76 Q 135 60 155 76 Q 135 92 115 76 Z"
            fill="#000000"
            stroke="url(#goldMaskGrad)"
            strokeWidth="2"
          />

          {/* Gold Filigree Ornaments */}
          <path
            d="M 100 48 Q 100 30 100 20 Q 95 35 88 42 M 100 20 Q 105 35 112 42"
            fill="none"
            stroke="url(#goldMaskGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="100" cy="20" r="4" fill="#D4AF37" />

          {/* Cheek Filigree Scrolls */}
          <path
            d="M 28 65 Q 18 80 32 95 Q 40 85 30 75"
            fill="none"
            stroke="url(#goldMaskGrad)"
            strokeWidth="1.8"
          />
          <path
            d="M 172 65 Q 182 80 168 95 Q 160 85 170 75"
            fill="none"
            stroke="url(#goldMaskGrad)"
            strokeWidth="1.8"
          />
        </svg>
      );

    case 'cool':
      return (
        <svg viewBox="0 0 200 160" className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]">
          {/* Aviator Sunglasses */}
          <g>
            {/* Gold Frame Bridge */}
            <path d="M 85 52 Q 100 48 115 52" fill="none" stroke="#D4AF37" strokeWidth="4" />
            <path d="M 88 44 Q 100 40 112 44" fill="none" stroke="#D4AF37" strokeWidth="2.5" />
            
            {/* Left Lens */}
            <path
              d="M 32 46 L 85 46 C 88 75 75 92 58 92 C 40 92 28 75 32 46 Z"
              fill="#0F172A"
              stroke="#D4AF37"
              strokeWidth="3.5"
            />
            {/* Left Lens Glare */}
            <polygon points="40,52 65,52 50,84 36,84" fill="#FFFFFF" opacity="0.2" />

            {/* Right Lens */}
            <path
              d="M 115 46 L 168 46 C 172 75 160 92 142 92 C 125 92 112 75 115 46 Z"
              fill="#0F172A"
              stroke="#D4AF37"
              strokeWidth="3.5"
            />
            {/* Right Lens Glare */}
            <polygon points="123,52 148,52 133,84 119,84" fill="#FFFFFF" opacity="0.2" />
          </g>

          {/* Gentleman Curly Mustache */}
          <path
            d="M 100 120 
               C 85 108 55 106 40 124 
               C 32 134 40 142 48 136 
               C 62 125 82 130 100 134
               C 118 130 138 125 152 136 
               C 160 142 168 134 160 124 
               C 145 106 115 108 100 120 Z"
            fill="#18181B"
            stroke="#27272A"
            strokeWidth="1.5"
            filter="drop-shadow(0 4px 6px rgba(0,0,0,0.4))"
          />
        </svg>
      );

    case 'cat':
      return (
        <svg viewBox="0 0 200 180" className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
          {/* Left Cat Ear */}
          <polygon points="35,70 50,15 85,55" fill="#1E293B" stroke="#0F172A" strokeWidth="2" />
          <polygon points="44,65 52,25 78,54" fill="#F472B6" />

          {/* Right Cat Ear with Mini Santa Hat */}
          <polygon points="165,70 150,15 115,55" fill="#1E293B" stroke="#0F172A" strokeWidth="2" />
          <polygon points="156,65 148,25 122,54" fill="#F472B6" />

          {/* Mini Santa Hat on Right Ear */}
          <path d="M 140 35 L 180 5 L 165 42 Z" fill="#DC2626" />
          <circle cx="180" cy="5" r="7" fill="#FFFFFF" />
          <rect x="135" y="34" width="36" height="8" rx="4" fill="#FFFFFF" transform="rotate(-15 153 38)" />

          {/* Cute Cat Whiskers Left */}
          <g stroke="#F8FAFC" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
            <line x1="25" y1="102" x2="72" y2="108" />
            <line x1="22" y1="115" x2="70" y2="115" />
            <line x1="26" y1="128" x2="72" y2="122" />
          </g>

          {/* Cute Cat Whiskers Right */}
          <g stroke="#F8FAFC" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
            <line x1="175" y1="102" x2="128" y2="108" />
            <line x1="178" y1="115" x2="130" y2="115" />
            <line x1="174" y1="128" x2="128" y2="122" />
          </g>

          {/* Cute Pink Cat Nose & Mouth */}
          <path d="M 94 105 L 106 105 L 100 114 Z" fill="#F43F5E" />
          <path
            d="M 100 114 L 100 120 
               M 100 120 Q 90 128 84 122 
               M 100 120 Q 110 128 116 122"
            fill="none"
            stroke="#F8FAFC"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Rosy Cheeks */}
          <ellipse cx="65" cy="116" rx="10" ry="6" fill="#FB7185" opacity="0.5" />
          <ellipse cx="135" cy="116" rx="10" ry="6" fill="#FB7185" opacity="0.5" />
        </svg>
      );

    case 'blur':
      return (
        <div className="w-full h-full rounded-[45%] backdrop-blur-xl bg-black/50 border-2 border-[#D4AF37]/70 shadow-[0_0_20px_rgba(212,175,55,0.4)] flex flex-col items-center justify-center p-2 text-center select-none">
          <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center mb-1">
            <svg className="w-4 h-4 text-[#F5E6BF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <span className="text-[10px] text-[#F5E6BF] font-sans font-semibold tracking-wider uppercase">Ẩn danh</span>
        </div>
      );

    default:
      return null;
  }
};
