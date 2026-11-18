import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ActiveTrack, MusicSourceType } from '../types';

export interface MusicPlayerProps {
  track?: ActiveTrack | null;
  onTrackChange?: (track: ActiveTrack | null) => void;
}

const PRESET_TRACKS = [
  {
    title: 'We Wish You A Merry Christmas',
    artist: 'Traditional Holiday Carol',
    type: 'audio' as const,
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/cb/We_Wish_You_a_Merry_Christmas.ogg',
    emoji: '🎄',
  },
  {
    title: 'Jingle Bell Rock',
    artist: 'Bobby Helms (Classic)',
    type: 'youtube' as const,
    url: 'https://www.youtube.com/watch?v=R_vmuJ3974M',
    embedId: 'R_vmuJ3974M',
    emoji: '🔔',
  },
  {
    title: 'Last Christmas',
    artist: 'Wham! (Holiday Classic)',
    type: 'youtube' as const,
    url: 'https://www.youtube.com/watch?v=E8gmARGvPlI',
    embedId: 'E8gmARGvPlI',
    emoji: '❄️',
  },
  {
    title: 'All I Want for Christmas Is You',
    artist: 'Mariah Carey',
    type: 'youtube' as const,
    url: 'https://www.youtube.com/watch?v=yXQViqx6GMY',
    embedId: 'yXQViqx6GMY',
    emoji: '🌟',
  },
  {
    title: 'Christmas Lofi / Holiday Coffee Shop',
    artist: 'Cozy Chill Holiday Beats',
    type: 'youtube' as const,
    url: 'https://www.youtube.com/watch?v=lTRiuFIWV54',
    embedId: 'lTRiuFIWV54',
    emoji: '☕',
  },
  {
    title: 'Jingle Bells (Orchestral)',
    artist: 'Kevin MacLeod',
    type: 'audio' as const,
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Jingle_Bells_-_Kevin_MacLeod.ogg',
    emoji: '🎶',
  },
  {
    title: 'Deck the Halls',
    artist: 'Holiday Brass & Strings',
    type: 'audio' as const,
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Deck_the_Halls_-_Kevin_MacLeod.ogg',
    emoji: '🎺',
  },
  {
    title: 'Silent Night',
    artist: 'Acoustic Holiday Bells',
    type: 'audio' as const,
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Silent_Night_-_Kevin_MacLeod.ogg',
    emoji: '🕊️',
  },
];

// Parse URL from YouTube, Spotify, ZingMP3 or direct audio
export const parseMusicUrl = (rawUrl: string): ActiveTrack | null => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // 1. YouTube
  const ytRegex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i;
  const ytMatch = trimmed.match(ytRegex);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      url: trimmed,
      embedId: ytMatch[1],
      title: 'YouTube Track',
    };
  }

  // 2. Spotify
  const spotifyRegex = /open\.spotify\.com\/(track|playlist|album)\/([a-zA-Z0-9]+)/i;
  const spotifyMatch = trimmed.match(spotifyRegex);
  if (spotifyMatch && spotifyMatch[1] && spotifyMatch[2]) {
    return {
      type: 'spotify',
      url: trimmed,
      embedId: spotifyMatch[2],
      extraType: spotifyMatch[1] as 'track' | 'playlist' | 'album',
      title: `Spotify ${spotifyMatch[1].toUpperCase()}`,
    };
  }

  // 3. ZingMP3
  const zingRegex = /zingmp3\.vn\/(?:bai-hat\/[^/]+\/|embed\/song\/|song\/)?([A-Z0-9]{8,12})(?:\.html)?/i;
  const zingMatch = trimmed.match(zingRegex);
  if (trimmed.includes('zingmp3.vn') && zingMatch && zingMatch[1]) {
    return {
      type: 'zing',
      url: trimmed,
      embedId: zingMatch[1],
      title: 'ZingMP3 Track',
    };
  }

  // 4. Direct Audio (.mp3, .ogg, .wav, .m4a, .aac, or URL containing audio)
  const audioExtensions = /\.(mp3|ogg|wav|m4a|aac)(\?.*)?$/i;
  if (audioExtensions.test(trimmed) || trimmed.startsWith('data:audio/') || trimmed.startsWith('blob:')) {
    return {
      type: 'audio',
      url: trimmed,
      embedId: '',
      title: trimmed.split('/').pop()?.split('?')[0] || 'Audio Track',
    };
  }

  // 5. Fallback as generic audio stream if URL looks like an HTTP stream
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return {
      type: 'audio',
      url: trimmed,
      embedId: '',
      title: 'Online Audio Stream',
    };
  }

  return null;
};

export const MusicPlayer: React.FC<MusicPlayerProps> = ({ track, onTrackChange }) => {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  // Default is strictly null - Music does NOT automatically turn on
  const [activeTrack, setActiveTrack] = useState<ActiveTrack | null>(track || null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync with track prop if provided (e.g. from shared link or parent)
  useEffect(() => {
    if (track !== undefined) {
      setActiveTrack(track);
    }
  }, [track]);

  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('christmas_music_volume');
    return saved ? parseFloat(saved) : 0.7;
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    localStorage.setItem('christmas_music_volume', String(volume));
  }, [volume]);

  // Click outside to close popup without stopping music
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePlayFromInput = () => {
    setErrorMsg('');
    if (!inputUrl.trim()) return;

    const parsed = parseMusicUrl(inputUrl);
    if (!parsed) {
      setErrorMsg(t('musicInvalidLink'));
      return;
    }

    playTrack(parsed);
    setInputUrl('');
  };

  const playTrack = (selected: ActiveTrack) => {
    setActiveTrack(selected);
    setIsPlaying(true);
    setErrorMsg('');
    onTrackChange?.(selected);

    // If direct audio, play native element
    if (selected.type === 'audio') {
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = selected.url;
          audioRef.current.play().catch((err) => {
            console.warn('Audio play autoplay error:', err);
          });
        }
      }, 50);
    } else {
      // Pause native audio if switching to iframe embed
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setActiveTrack(null);
    setIsPlaying(false);
    onTrackChange?.(null);
  };

  const handleTogglePlayPause = () => {
    if (!activeTrack) return;

    if (activeTrack.type === 'audio' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div ref={containerRef} className="relative select-none font-sans">
      {/* Hidden Native Audio Element for Direct MP3 / Audio streams */}
      <audio
        ref={audioRef}
        loop
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => setErrorMsg('Không thể phát tệp âm thanh này')}
      />

      {/* Floating Music Button (Luxury Gold Glassmorphism) */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        title={t('musicTooltip')}
        className={`group relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border backdrop-blur-md transition-all duration-300 cursor-pointer ${
          isPlaying
            ? 'border-[#D4AF37] bg-[#D4AF37]/25 text-[#F5E6BF] shadow-[0_0_18px_rgba(212,175,55,0.45)]'
            : 'border-[#D4AF37]/50 bg-black/85 hover:bg-[#D4AF37]/20 text-[#D4AF37] hover:text-[#F5E6BF] shadow-[0_0_10px_rgba(0,0,0,0.5)]'
        }`}
      >
        {/* Animated Equalizer Wave / Music Note */}
        {isPlaying ? (
          <div className="flex items-end gap-[2px] h-3.5 py-0.5">
            <span className="w-[3px] bg-amber-400 rounded-full animate-[bounce_0.8s_infinite] h-2"></span>
            <span className="w-[3px] bg-yellow-300 rounded-full animate-[bounce_0.6s_infinite_0.2s] h-3.5"></span>
            <span className="w-[3px] bg-amber-300 rounded-full animate-[bounce_0.9s_infinite_0.4s] h-2.5"></span>
          </div>
        ) : (
          <span className="text-sm group-hover:scale-110 transition-transform">🎵</span>
        )}

        <span className="text-xs font-semibold tracking-wide">
          {t('musicBtn')}
        </span>

        {/* Small Active Dot */}
        {isPlaying && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5"></span>
        )}
      </button>

      {/* 
        Music Controller Dropdown Modal 
        CRITICAL: Never conditionally unmount this modal with {isOpen && (...)}.
        Instead, toggle visibility via opacity and pointer-events so that YouTube, Spotify, ZingMP3 iframes
        and HTML5 audio CONTINUE PLAYING smoothly in the background when the user closes the popup!
      */}
      <div
        className={`fixed top-14 left-3 right-3 sm:left-auto sm:right-0 sm:absolute sm:top-10 w-auto sm:w-[340px] md:w-[380px] max-w-[calc(100vw-24px)] max-h-[82vh] overflow-y-auto p-3.5 sm:p-4 bg-black/95 backdrop-blur-xl border-2 border-[#D4AF37] rounded-xl shadow-[0_0_35px_rgba(212,175,55,0.4)] z-50 text-[#F5E6BF] transition-all duration-200 origin-top sm:origin-top-right ${
          isOpen
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#D4AF37]/30">
          <div className="flex items-center gap-2">
            <span className="text-base">🎶</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#F5E6BF]">
              {t('musicTitle')}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Playing Badge */}
            {isPlaying && (
              <span className="flex items-center gap-1 text-[9px] text-emerald-300 bg-emerald-950/70 border border-emerald-500/40 px-1.5 py-0.5 rounded-full font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {language === 'vi' ? 'Đang phát' : 'Playing'}
              </span>
            )}

            {/* Close button: Only closes/hides the popup, DOES NOT stop playback! */}
            <button
              onClick={() => setIsOpen(false)}
              className="w-5 h-5 rounded flex items-center justify-center text-[#D4AF37] hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs"
              title={language === 'vi' ? 'Đóng bảng (Nhạc vẫn tiếp tục phát)' : 'Close popup (Music keeps playing)'}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Helpful notice to user */}
        <div className="mb-2.5 px-2 py-1 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center gap-1.5 text-[10px] text-[#F5E6BF]/80">
          <span>💡</span>
          <span>{language === 'vi' ? 'Nhạc vẫn phát liên tục khi bạn đóng bảng' : 'Music keeps playing when you close this popup'}</span>
        </div>

        {/* URL Input Bar */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePlayFromInput()}
              placeholder={t('musicInputPlaceholder')}
              className="flex-1 bg-white/5 border border-[#D4AF37]/40 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
            />
            <button
              onClick={handlePlayFromInput}
              className="px-3 py-1.5 bg-[#D4AF37] hover:bg-[#f3cc52] text-black font-semibold text-xs rounded-lg transition-all shadow-[0_0_10px_rgba(212,175,55,0.3)] hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
            >
              {t('musicPlayBtn')}
            </button>
          </div>

          <p className="text-[10px] text-[#D4AF37]/80">
            {t('musicSupportedHint')}
          </p>

          {errorMsg && (
            <p className="text-[11px] text-rose-400 bg-rose-950/40 px-2 py-1 rounded border border-rose-500/30">
              ⚠️ {errorMsg}
            </p>
          )}
        </div>

        {/* Active Player Display Area */}
        {activeTrack ? (
          <div className="mb-3 p-2.5 rounded-lg bg-white/5 border border-[#D4AF37]/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">
                  {activeTrack.type === 'youtube' && '🔴'}
                  {activeTrack.type === 'spotify' && '🟢'}
                  {activeTrack.type === 'zing' && '🟣'}
                  {activeTrack.type === 'audio' && '🎵'}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-[#F5E6BF] truncate">
                    {activeTrack.title}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {activeTrack.type === 'youtube' && t('musicPlatformYoutube')}
                    {activeTrack.type === 'spotify' && t('musicPlatformSpotify')}
                    {activeTrack.type === 'zing' && t('musicPlatformZing')}
                    {activeTrack.type === 'audio' && t('musicPlatformAudio')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Stop Button - Completely stops the music */}
                <button
                  onClick={handleStop}
                  title={language === 'vi' ? 'Tắt / Dừng hẳn nhạc' : 'Stop music completely'}
                  className="px-2 py-1 rounded-md bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 hover:text-white transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                >
                  <span>⏹</span>
                  <span className="text-[10px]">{t('musicStopBtn')}</span>
                </button>
              </div>
            </div>

            {/* YouTube Embedded Player - stays mounted continuously */}
            {activeTrack.type === 'youtube' && (
              <div className="relative w-full aspect-video rounded-md overflow-hidden border border-[#D4AF37]/40 shadow-md">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${activeTrack.embedId}?autoplay=1&enablejsapi=1&playsinline=1`}
                  title="YouTube Player"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            )}

            {/* Spotify Embedded Player */}
            {activeTrack.type === 'spotify' && (
              <div className="relative w-full rounded-md overflow-hidden border border-[#D4AF37]/40">
                <iframe
                  src={`https://open.spotify.com/embed/${activeTrack.extraType || 'track'}/${activeTrack.embedId}?utm_source=generator&theme=0`}
                  width="100%"
                  height="80"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  className="rounded-md"
                />
              </div>
            )}

            {/* ZingMP3 Embedded Player */}
            {activeTrack.type === 'zing' && (
              <div className="relative w-full rounded-md overflow-hidden border border-[#D4AF37]/40">
                <iframe
                  src={`https://zingmp3.vn/embed/song/${activeTrack.embedId}?start=true`}
                  width="100%"
                  height="80"
                  allow="autoplay"
                  className="rounded-md"
                />
              </div>
            )}

            {/* Direct Audio Native Controls & Volume */}
            {activeTrack.type === 'audio' && (
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between gap-3 text-xs">
                <button
                  onClick={handleTogglePlayPause}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#D4AF37]/20 border border-[#D4AF37]/40 hover:bg-[#D4AF37]/35 text-[#F5E6BF] transition-all cursor-pointer"
                >
                  {isPlaying ? '⏸ ' + t('musicPauseBtn') : '▶ ' + t('musicPlayBtn')}
                </button>

                <div className="flex items-center gap-1.5 flex-1 max-w-[130px]">
                  <span className="text-[10px]">🔊</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full accent-[#D4AF37] h-1.5 bg-white/20 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-center text-[11px] text-gray-400">
            {t('musicNoTrack')}
          </div>
        )}

        {/* Preset Holiday Carols Grid */}
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#D4AF37] mb-2 flex items-center gap-1.5">
            <span>{t('musicPresetsTitle')}</span>
          </h4>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {PRESET_TRACKS.map((preset, idx) => {
              const isThisActive = activeTrack?.url === preset.url;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (preset.type === 'youtube') {
                      playTrack({
                        type: 'youtube',
                        url: preset.url,
                        embedId: preset.embedId || '',
                        title: preset.title,
                      });
                    } else {
                      playTrack({
                        type: 'audio',
                        url: preset.url,
                        embedId: '',
                        title: preset.title,
                      });
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                    isThisActive
                      ? 'border-[#D4AF37] bg-[#D4AF37]/30 text-white font-medium shadow-[0_0_10px_rgba(212,175,55,0.25)]'
                      : 'border-[#D4AF37]/20 bg-white/5 hover:bg-white/10 hover:border-[#D4AF37]/50 text-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm flex-shrink-0">{preset.emoji}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs truncate">{preset.title}</span>
                      <span className="text-[9px] text-[#D4AF37]/80 truncate">
                        {preset.artist}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] text-[#D4AF37] ml-2 flex-shrink-0">
                    {isThisActive && isPlaying ? '▶' : '♫'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
