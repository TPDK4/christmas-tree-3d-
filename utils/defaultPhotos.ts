// Default Christmas Polaroid Card Placeholders (Used when user hasn't uploaded 5 custom photos)

export interface PhotoInfo {
  url: string;
  title: string;
  desc: string;
}

const createSvgCard = (bgGradient: [string, string], iconSvg: string, title: string, subtitle: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgGradient[0]}" />
        <stop offset="100%" stop-color="${bgGradient[1]}" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="40%" r="50%">
        <stop offset="0%" stop-color="#FFF2A3" stop-opacity="0.35" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0" />
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.4" />
      </filter>
    </defs>
    <!-- Background -->
    <rect width="600" height="600" fill="url(#grad)" />
    <circle cx="300" cy="240" r="220" fill="url(#glow)" />
    <!-- Decorative Frame Border -->
    <rect x="25" y="25" width="550" height="550" fill="none" stroke="#D4AF37" stroke-width="2" stroke-dasharray="6,4" opacity="0.6" rx="8" />
    <rect x="35" y="35" width="530" height="530" fill="none" stroke="#F5E6BF" stroke-width="1" opacity="0.4" rx="6" />
    <!-- Corner Ornaments -->
    <text x="50" y="70" font-size="24" fill="#D4AF37" opacity="0.7">❄</text>
    <text x="530" y="70" font-size="24" fill="#D4AF37" opacity="0.7">❄</text>
    <text x="50" y="550" font-size="24" fill="#D4AF37" opacity="0.7">❄</text>
    <text x="530" y="550" font-size="24" fill="#D4AF37" opacity="0.7">❄</text>
    <!-- Center Icon Artwork -->
    <g filter="url(#shadow)" transform="translate(150, 90)">
      ${iconSvg}
    </g>
    <!-- Title & Subtitle -->
    <text x="300" y="460" font-family="'Playfair Display', 'Be Vietnam Pro', 'Montserrat', Georgia, serif" font-size="28" font-weight="bold" fill="#F5E6BF" text-anchor="middle" letter-spacing="1">
      ${title}
    </text>
    <text x="300" y="500" font-family="'Be Vietnam Pro', 'Montserrat', sans-serif" font-size="16" fill="#D4AF37" text-anchor="middle" opacity="0.9">
      ${subtitle}
    </text>
  </svg>`;
  const base64Svg = typeof window !== 'undefined' && window.btoa
    ? window.btoa(unescape(encodeURIComponent(svg)))
    : Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64Svg}`;
};

// 1. Christmas Tree & Star (1 ngón)
const photo1Svg = `<g transform="scale(3)">
  <!-- Tree Layers -->
  <polygon points="50,15 25,50 75,50" fill="#1b4d3e" />
  <polygon points="50,30 20,70 80,70" fill="#143d31" />
  <polygon points="50,50 15,95 85,95" fill="#0d2b22" />
  <!-- Tree Trunk -->
  <rect x="44" y="95" width="12" height="15" fill="#5c3818" rx="2" />
  <!-- Ornaments -->
  <circle cx="45" cy="40" r="3" fill="#D4AF37" />
  <circle cx="58" cy="45" r="2.5" fill="#e63946" />
  <circle cx="35" cy="62" r="3" fill="#e63946" />
  <circle cx="62" cy="65" r="3" fill="#D4AF37" />
  <circle cx="30" cy="85" r="3" fill="#D4AF37" />
  <circle cx="50" cy="80" r="3.5" fill="#f4a261" />
  <circle cx="70" cy="88" r="3" fill="#e63946" />
  <!-- Top Star -->
  <polygon points="50,3 53,12 62,12 55,18 57,27 50,21 43,27 45,18 38,12 47,12" fill="#FFE55C" stroke="#D4AF37" stroke-width="0.5" />
</g>`;

// 2. Golden Christmas Bells (2 ngón)
const photo2Svg = `<g transform="scale(3)">
  <!-- Left Bell -->
  <path d="M42,35 C42,20 28,20 28,35 L24,55 C22,60 18,62 18,65 L52,65 C52,62 48,60 46,55 Z" fill="#D4AF37" stroke="#FFE55C" stroke-width="1" />
  <circle cx="35" cy="66" r="4" fill="#8C6D1F" />
  <!-- Right Bell -->
  <path d="M72,40 C72,25 58,25 58,40 L54,60 C52,65 48,67 48,70 L82,70 C82,67 78,65 76,60 Z" fill="#E5C158" stroke="#FFE55C" stroke-width="1" />
  <circle cx="65" cy="71" r="4" fill="#8C6D1F" />
  <!-- Red Ribbon -->
  <path d="M50,25 C45,15 35,18 45,28 C35,38 50,42 50,30 C50,42 65,38 55,28 C65,18 55,15 50,25 Z" fill="#b91c1c" />
  <circle cx="50" cy="27" r="4" fill="#dc2626" />
</g>`;

// 3. Cozy Winter Snow & Candle (3 ngón)
const photo3Svg = `<g transform="scale(3)">
  <!-- Candle Base & Plate -->
  <ellipse cx="50" cy="80" rx="35" ry="8" fill="#D4AF37" />
  <ellipse cx="50" cy="78" rx="30" ry="6" fill="#F5E6BF" />
  <!-- Candle Body -->
  <path d="M38,40 L38,78 C38,82 62,82 62,78 L62,40 C62,38 38,38 38,40 Z" fill="#FAF5E8" />
  <ellipse cx="50" cy="40" rx="12" ry="3" fill="#E8DEC3" />
  <!-- Wick & Flame -->
  <line x1="50" y1="40" x2="50" y2="33" stroke="#333" stroke-width="1.5" />
  <path d="M50,15 C45,24 46,33 50,33 C54,33 55,24 50,15 Z" fill="#FF9E00" />
  <path d="M50,20 C48,25 48,31 50,31 C52,31 52,25 50,20 Z" fill="#FFEE55" />
  <!-- Holly Berries and Leaves -->
  <circle cx="35" cy="76" r="4" fill="#b91c1c" />
  <circle cx="41" cy="79" r="4" fill="#dc2626" />
  <circle cx="36" cy="82" r="4" fill="#991b1b" />
</g>`;

// 4. Santa Sleigh & Starry Night (4 ngón)
const photo4Svg = `<g transform="scale(3)">
  <!-- Big Crescent Moon -->
  <path d="M65,10 A25,25 0 0,1 65,55 A28,28 0 1,0 65,10 Z" fill="#FFF2A3" />
  <!-- Sleigh Silhouette -->
  <path d="M25,50 C35,50 40,40 55,42 C60,43 65,48 62,55 C60,60 45,62 30,60 Z" fill="#D4AF37" />
  <path d="M20,65 L65,65 C68,65 72,62 70,58" stroke="#FFE55C" stroke-width="2" fill="none" stroke-linecap="round" />
  <!-- Santa Hat on Sleigh -->
  <polygon points="38,38 48,38 43,26" fill="#b91c1c" />
  <circle cx="43" cy="25" r="2.5" fill="#ffffff" />
  <rect x="36" y="38" width="14" height="4" rx="2" fill="#ffffff" />
</g>`;

// 5. Gift Box & Gold Ribbon (5 ngón)
const photo5Svg = `<g transform="scale(3)">
  <!-- Gift Box Body -->
  <rect x="25" y="45" width="50" height="45" fill="#881337" rx="3" />
  <rect x="20" y="38" width="60" height="12" fill="#9f1239" rx="2" />
  <!-- Golden Ribbon Vertical & Horizontal -->
  <rect x="45" y="38" width="10" height="52" fill="#D4AF37" />
  <rect x="20" y="42" width="60" height="6" fill="#D4AF37" />
  <!-- Bow -->
  <path d="M50,38 C42,25 30,30 45,36 Z" fill="#FFE55C" stroke="#D4AF37" stroke-width="0.8" />
  <path d="M50,38 C58,25 70,30 55,36 Z" fill="#FFE55C" stroke="#D4AF37" stroke-width="0.8" />
  <circle cx="50" cy="37" r="3" fill="#D4AF37" />
</g>`;

export const DEFAULT_CHRISTMAS_PHOTOS: PhotoInfo[] = [
  {
    url: '/photos/1.jpg',
    title: 'Merry Christmas',
    desc: 'Merry Christmas'
  },
  {
    url: '/photos/2.jpg',
    title: 'Merry Christmas',
    desc: 'Merry Christmas'
  },
  {
    url: '/photos/3.jpg',
    title: 'Merry Christmas',
    desc: 'Merry Christmas'
  },
  {
    url: '/photos/4.jpg',
    title: 'Merry Christmas',
    desc: 'Merry Christmas'
  },
  {
    url: '/photos/5.jpg',
    title: 'Merry Christmas',
    desc: 'Merry Christmas'
  }
];

/**
 * Get photo info for index 1..5:
 * Returns the photo at slot (index - 1).
 */
export function getPhotoByIndex(index: number, uploadedPhotos: string[]): PhotoInfo {
  const zeroIndex = index - 1;
  const list = (uploadedPhotos && uploadedPhotos.length > 0) ? uploadedPhotos : DEFAULT_CHRISTMAS_PHOTOS.map(p => p.url);
  if (list[zeroIndex]) {
    return {
      url: list[zeroIndex],
      title: 'Merry Christmas',
      desc: 'Merry Christmas'
    };
  }

  return {
    url: '',
    title: '',
    desc: ''
  };
}
