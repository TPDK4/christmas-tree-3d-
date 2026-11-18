import React, { useRef, useState } from 'react';
import { TreeMode, ActiveTrack, MaskType } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface UIOverlayProps {
  mode: TreeMode;
  onToggle: () => void;
  onPhotosUpload: (photos: string[]) => void;
  hasPhotos: boolean;
  uploadedPhotos: string[];
  isSharedView: boolean;
  currentMask: MaskType;
  currentMusic: ActiveTrack | null;
}

const MAX_PHOTOS = 5;

export const UIOverlay: React.FC<UIOverlayProps> = ({
  mode,
  onToggle,
  onPhotosUpload,
  hasPhotos,
  uploadedPhotos,
  isSharedView,
  currentMask,
  currentMusic,
}) => {
  const { t, language } = useLanguage();
  const isFormed = mode === TreeMode.FORMED;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string>('');
  const [shareError, setShareError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [isPanelMinimized, setIsPanelMinimized] = useState<boolean>(false);

  // Compress photo before adding to state (optimizes texture RAM & upload speed)
  const compressImageFile = (file: File, maxDim = 720, quality = 0.72): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      };
      reader.onerror = () => reject(new Error(`Không thể đọc tệp ${file.name}`));
      reader.readAsDataURL(file);
    });
  };

  // Ensure data URL is within compact bounds (< 80KB each) to avoid hitting serverless body payload limits
  const compressDataUrl = (dataUrl: string, maxDim = 720, quality = 0.72): Promise<string> => {
    return new Promise((resolve) => {
      if (!dataUrl.startsWith('data:image/') || dataUrl.length < 50000) {
        return resolve(dataUrl);
      }
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError('');
    const remainingSlots = MAX_PHOTOS - uploadedPhotos.length;
    if (remainingSlots <= 0) {
      setUploadError(`Bạn chỉ có thể tải tối đa ${MAX_PHOTOS} ảnh`);
      e.target.value = '';
      return;
    }

    const selectedFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (selectedFiles.length === 0) {
      setUploadError('Vui lòng chọn tệp hình ảnh');
      e.target.value = '';
      return;
    }

    const filesToRead = selectedFiles.slice(0, remainingSlots);
    const readers = filesToRead.map((file) => compressImageFile(file));

    Promise.all(readers)
      .then((urls) => {
        onPhotosUpload([...uploadedPhotos, ...urls]);
        setShareLink('');
        if (selectedFiles.length > remainingSlots) {
          setUploadError(`Đã thêm ${remainingSlots} ảnh. Tối đa ${MAX_PHOTOS} ảnh`);
        }
      })
      .catch((error: Error) => {
        console.error('Photo reading error:', error);
        setUploadError(error.message || 'Không thể đọc ảnh, vui lòng thử lại');
      })
      .finally(() => {
        e.target.value = '';
      });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleClearPhotos = () => {
    onPhotosUpload([]);
    setShareLink('');
    setShareError('');
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    setShareError('');
    setShareLink('');
    setUploadProgress(language === 'vi' ? 'Đang chuẩn bị link chia sẻ...' : 'Preparing share link...');

    try {
      const origin = window.location.origin;
      const maskParam = currentMask;
      const musicParam = currentMusic ? encodeURIComponent(currentMusic.url) : '';

      // CASE A: User uploaded custom photos (1 to 5 images) -> Cloudflare R2 + KV via /api/upload
      if (uploadedPhotos && uploadedPhotos.length > 0) {
        // Strategy 1: Serverless upload to Cloudflare R2 + KV
        // Works seamlessly across all devices, zero CORS issues, zero SSL cert mismatch
        try {
          setUploadProgress(language === 'vi' ? 'Đang tối ưu ảnh và tải lên máy chủ...' : 'Optimizing and uploading...');

          // Re-compress all photos right before upload to strictly ensure payload stays tiny (~250-400KB total)
          const optimizedPhotos = await Promise.all(
            uploadedPhotos.map((photo) => compressDataUrl(photo, 720, 0.72))
          );

          const serverUploadResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              images: optimizedPhotos,
              music: currentMusic,
              mask: currentMask,
            }),
          });

          if (serverUploadResponse.ok) {
            const serverData = await serverUploadResponse.json();
            let finalLink = serverData.shareLink || `${origin}/?share=${serverData.shareId}`;
            if (maskParam !== 'none' && !finalLink.includes('mask=')) finalLink += `&mask=${maskParam}`;
            if (musicParam && !finalLink.includes('music=')) finalLink += `&music=${musicParam}`;
            setShareLink(finalLink);
            return;
          } else {
            let errorDetail = '';
            try {
              const rawText = await serverUploadResponse.text();
              try {
                const errBody = JSON.parse(rawText);
                errorDetail = errBody.message || errBody.error || '';
              } catch {
                if (serverUploadResponse.status === 413 || rawText.includes('FUNCTION_PAYLOAD_TOO_LARGE')) {
                  errorDetail = 'Dung lượng ảnh vượt quá giới hạn máy chủ (4.5MB). Vui lòng chọn ảnh dung lượng nhẹ hơn.';
                } else if (serverUploadResponse.status === 504 || rawText.includes('FUNCTION_INVOCATION_TIMEOUT')) {
                  errorDetail = 'Quá thời gian xử lý khi tải ảnh (Timeout). Vui lòng thử lại.';
                } else if (rawText) {
                  const match = rawText.match(/Code: <code>([^<]+)<\/code>/i) || rawText.match(/<title>([^<]+)<\/title>/i);
                  errorDetail = match ? match[1] : rawText.slice(0, 150);
                }
              }
            } catch (readErr) {
              console.warn('Failed to read response body:', readErr);
            }
            throw new Error(errorDetail || `Tải ảnh lên máy chủ thất bại (HTTP ${serverUploadResponse.status})`);
          }
        } catch (serverErr: any) {
          console.warn('Server upload failed:', serverErr);
          const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          if (!isLocal) {
            throw serverErr;
          }
        }

        // Strategy 2: Fallback for custom photos if backend is completely unavailable
        const shareId = Math.random().toString(36).substring(2, 10);
        const shareData = {
          images: uploadedPhotos,
          music: currentMusic,
          mask: currentMask,
          createdAt: Date.now(),
        };
        try {
          localStorage.setItem(`share_${shareId}`, JSON.stringify(shareData));
        } catch (e) {}

        let fallbackLink = `${origin}/?share=${shareId}`;
        if (maskParam !== 'none' && !fallbackLink.includes('mask=')) fallbackLink += `&mask=${maskParam}`;
        if (musicParam && !fallbackLink.includes('music=')) fallbackLink += `&music=${musicParam}`;
        setShareLink(fallbackLink);
        return;
      }

      // CASE B: User did NOT upload custom photos (keeps the 5 festive default photos)
      // Works instantly across all browsers and devices with 0 backend dependencies!
      let directLink = `${origin}/?tree=christmas`;
      if (maskParam !== 'none') directLink += `&mask=${maskParam}`;
      if (musicParam) directLink += `&music=${musicParam}`;
      setShareLink(directLink);

    } catch (error: any) {
      console.error('Share error:', error);
      setShareError(error.message || 'Chia sẻ thất bại, vui lòng thử lại');
    } finally {
      setIsSharing(false);
      setUploadProgress('');
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleCreateMine = () => {
    // Xóa URL tham số, tải lại trang
    window.location.href = window.location.origin;
  };

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
      
      {/* Header - Placed cleanly below top buttons on mobile (top-[86px]) and at top on desktop (sm:top-5 md:top-7) */}
      <header className="absolute top-[86px] sm:top-5 md:top-7 left-1/2 transform -translate-x-1/2 flex flex-col items-center pointer-events-none select-none z-20 w-full px-4">
        <h1 className="text-xl sm:text-3xl md:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F5E6BF] to-[#D4AF37] font-serif drop-shadow-[0_4px_16px_rgba(212,175,55,0.4)] tracking-wider text-center whitespace-nowrap px-2 sm:px-6 pt-0.5 sm:pt-2 pb-1 sm:pb-4 leading-normal">
          Merry Christmas
        </h1>
      </header>

      {/* Right Bottom Action Area */}
      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 md:bottom-8 md:right-8 z-30 pointer-events-auto flex flex-col items-end pb-[env(safe-area-inset-bottom,0px)]">
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Shared View: Tree is already configured by sender. Recipient can only enjoy, change music and face AR */}
        {isSharedView && (
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleCreateMine}
              className="group relative flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#D4AF37]/50 bg-black/80 hover:bg-[#D4AF37]/20 backdrop-blur-md shadow-[0_0_15px_rgba(212,175,55,0.2)] hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-all duration-300 text-[#F5E6BF] hover:text-white cursor-pointer active:scale-95"
              title={t('createMine')}
            >
              <span className="text-sm">✨</span>
              <span className="font-sans text-xs font-semibold tracking-wide">
                {language === 'vi' ? 'Tạo cây thông của riêng bạn' : 'Create Your Own Tree'}
              </span>
            </button>
          </div>
        )}

        {/* Not Shared View: Show upload and share controls */}
        {!isSharedView && (
          <div className="flex flex-col items-end gap-2 w-full max-w-[calc(100vw-32px)] sm:max-w-[340px] md:max-w-[380px]">
            {isPanelMinimized ? (
              /* Minimized Floating Pill Button (Windows Taskbar style) */
              <button
                onClick={() => setIsPanelMinimized(false)}
                className="group relative flex items-center gap-2 sm:gap-2.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg border border-[#D4AF37]/70 bg-black/90 hover:bg-[#D4AF37]/20 backdrop-blur-md shadow-[0_0_20px_rgba(212,175,55,0.3)] text-[#F5E6BF] hover:text-white transition-all duration-200 cursor-pointer"
                title="Phóng to / Mở lại bảng"
              >
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4AF37]"></span>
                </span>

                {/* Preview avatar */}
                {uploadedPhotos.length > 0 ? (
                  <img
                    src={uploadedPhotos[uploadedPhotos.length - 1]}
                    alt="preview"
                    className="inline-block h-5 w-5 rounded ring-1 ring-[#D4AF37]/60 object-cover"
                  />
                ) : (
                  <span className="text-xs">🎄</span>
                )}

                <span className="font-sans text-xs font-medium tracking-wide">
                  {uploadedPhotos.length > 0 ? (
                    <>{t('uploadedCount')}: <strong className="text-[#D4AF37] font-semibold">{uploadedPhotos.length}</strong>/{MAX_PHOTOS}</>
                  ) : (
                    <span className="text-[#F5E6BF]">{language === 'vi' ? 'Tạo cây thông' : 'My Tree'}</span>
                  )}
                </span>

                {currentMusic && (
                  <span className="text-xs">🎵</span>
                )}

                {currentMask !== 'none' && (
                  <span className="text-xs">🎭</span>
                )}

                {shareLink && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded font-mono">
                    Link ✓
                  </span>
                )}

                {/* Windows-style restore square icon */}
                <div className="w-5 h-5 rounded flex items-center justify-center bg-white/5 group-hover:bg-[#D4AF37]/30 transition-colors ml-1">
                  <svg className="w-3 h-3 text-[#D4AF37] group-hover:text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
                  </svg>
                </div>
              </button>
            ) : (
              <div className="w-full bg-black/85 backdrop-blur-xl border border-[#D4AF37]/70 rounded-2xl p-3.5 sm:p-4 shadow-[0_0_30px_rgba(212,175,55,0.25)] flex flex-col gap-2.5 sm:gap-3 transition-all">
                
                {/* Panel Header: Photo count, preview thumbnails, Windows-style "-" and "✕" buttons */}
                <div className="flex items-center justify-between pb-2 border-b border-[#D4AF37]/25">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4AF37]"></span>
                    </span>
                    <span className="font-sans text-xs text-[#F5E6BF] tracking-wide">
                      {uploadedPhotos.length > 0 ? (
                        <>{t('uploadedCount')}: <strong className="text-[#D4AF37] text-sm font-semibold">{uploadedPhotos.length}</strong>/{MAX_PHOTOS}</>
                      ) : (
                        <span className="text-[#F5E6BF] font-semibold">{language === 'vi' ? 'Thiết lập Cây Thông' : 'Customize Tree'}</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Mini preview thumbnails if uploaded */}
                    {uploadedPhotos.length > 0 && (
                      <div className="flex -space-x-2 overflow-hidden mr-1">
                        {uploadedPhotos.slice(-3).map((photo, i) => (
                          <img
                            key={i}
                            src={photo}
                            alt="preview"
                            className="inline-block h-6 w-6 rounded-full ring-2 ring-[#D4AF37]/60 object-cover"
                          />
                        ))}
                      </div>
                    )}

                    {/* Trash Can Button - Delete all custom uploaded photos */}
                    {uploadedPhotos.length > 0 && (
                      <button
                        onClick={handleClearPhotos}
                        title={t('clearAllPhotos')}
                        className="w-7 h-7 rounded flex items-center justify-center text-red-400/80 hover:text-red-200 hover:bg-red-900/40 active:bg-red-800/60 border border-transparent hover:border-red-500/40 transition-all cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    )}

                    {/* Windows Minimize "-" Button */}
                    <button
                      onClick={() => setIsPanelMinimized(true)}
                      title={t('minimizeCamera')}
                      className="w-7 h-7 rounded flex items-center justify-center text-[#D4AF37] hover:text-white hover:bg-white/15 active:bg-white/25 border border-transparent hover:border-[#D4AF37]/40 transition-all cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="2" y="7.5" width="12" height="1.5" rx="0.5" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Configuration summary row (Photos + Music + AR Face) */}
                <div className="flex items-center gap-1.5 text-[11px] font-sans text-gray-300 bg-white/5 p-2 rounded-xl border border-[#D4AF37]/20 flex-wrap">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/40 border border-white/10">
                    <span>📸</span>
                    <span className="text-[#F5E6BF] font-medium">
                      {uploadedPhotos.length > 0 ? `${uploadedPhotos.length}/5 ảnh` : (language === 'vi' ? '5 ảnh mẫu' : '5 default')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/40 border border-white/10 max-w-[130px] truncate" title={currentMusic?.title}>
                    <span>🎵</span>
                    <span className="text-[#F5E6BF] font-medium truncate">
                      {currentMusic ? currentMusic.title : (language === 'vi' ? 'Chưa chọn nhạc' : 'No music')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/40 border border-white/10">
                    <span>🎭</span>
                    <span className="text-[#F5E6BF] font-medium">
                      {currentMask === 'none' ? (language === 'vi' ? 'Mặt gốc' : 'Real face') : currentMask}
                    </span>
                  </div>
                </div>

                {/* Actions Grid: [Tải ảnh] & [Tạo link chia sẻ] */}
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  {/* Nút Thêm ảnh */}
                  <button
                    onClick={handleUploadClick}
                    disabled={uploadedPhotos.length >= MAX_PHOTOS}
                    className="group relative flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:py-2.5 rounded-xl border border-[#D4AF37]/50 bg-black/60 hover:bg-[#D4AF37]/15 hover:border-[#D4AF37] text-[#D4AF37] hover:text-[#fff] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                  >
                    <svg className="w-4 h-4 text-[#D4AF37] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span className="font-sans text-xs sm:text-sm font-medium tracking-wide whitespace-nowrap">
                      {uploadedPhotos.length >= MAX_PHOTOS ? t('maxPhotosReached') : (uploadedPhotos.length > 0 ? (language === 'vi' ? 'Thêm ảnh' : 'Add Photo') : (language === 'vi' ? 'Tải ảnh lên' : 'Upload Photos'))}
                    </span>
                  </button>

                  {/* Nút Tạo link chia sẻ */}
                  <button
                    onClick={handleShare}
                    disabled={isSharing}
                    className="group relative flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:py-2.5 rounded-xl border-2 border-[#D4AF37] bg-gradient-to-r from-[#D4AF37]/25 via-[#F5E6BF]/30 to-[#D4AF37]/25 hover:from-[#D4AF37]/45 hover:via-[#F5E6BF]/45 hover:to-[#D4AF37]/45 text-[#F5E6BF] hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)]"
                  >
                    {isSharing ? (
                      <>
                        <svg className="animate-spin w-4 h-4 text-[#D4AF37]" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        <span className="font-sans text-xs tracking-wide truncate">
                          {uploadProgress || t('generatingLink')}
                        </span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 text-[#F5E6BF] group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        <span className="font-sans text-xs sm:text-sm font-semibold tracking-wide whitespace-nowrap">
                          {shareLink ? (language === 'vi' ? 'Tạo lại link' : 'Regenerate Link') : t('createShareLink')}
                        </span>
                      </>
                    )}
                  </button>
                </div>

                  {/* Share Link Display Box (When link is available) */}
                  {shareLink && (
                    <div className="mt-1 pt-3 border-t border-[#D4AF37]/25 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-sans text-[#F5E6BF] flex items-center gap-1.5 font-semibold">
                          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          Đã tạo liên kết chia sẻ
                        </span>
                        <span className="text-[10px] text-[#F5E6BF]/60 font-sans">
                          Hết hạn 30 ngày
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 bg-black/60 border border-[#D4AF37]/40 rounded-xl p-1.5 focus-within:border-[#D4AF37] transition-colors">
                        <input
                          type="text"
                          value={shareLink}
                          readOnly
                          className="flex-1 bg-transparent text-[#D4AF37] px-2 py-1 text-xs font-mono outline-none select-all truncate"
                        />
                        <button
                          onClick={handleCopyLink}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#D4AF37] bg-[#D4AF37]/20 hover:bg-[#D4AF37]/35 text-[#F5E6BF] hover:text-white transition-all text-xs font-sans font-semibold shrink-0 cursor-pointer"
                        >
                          {copied ? (
                            <>
                              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                              <span>Đã chép</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5 text-[#D4AF37]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                              <span>Sao chép</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Quick link: Open preview */}
                      <div className="flex items-center justify-end">
                        <a
                          href={shareLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-sans text-[#D4AF37]/80 hover:text-[#F5E6BF] underline underline-offset-2 flex items-center gap-1 transition-colors"
                        >
                          <span>Mở xem thử cây thông chia sẻ</span>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                          </svg>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Errors display */}
                  {uploadError && (
                    <p className="text-red-400 text-xs font-sans text-right bg-red-950/40 p-2 rounded-lg border border-red-500/30">{uploadError}</p>
                  )}
                  {shareError && (
                    <p className="text-red-400 text-xs font-sans text-right bg-red-950/40 p-2 rounded-lg border border-red-500/30">{shareError}</p>
                  )}
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
};