import React, { useRef, useState } from 'react';
import { TreeMode } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface UIOverlayProps {
  mode: TreeMode;
  onToggle: () => void;
  onPhotosUpload: (photos: string[]) => void;
  hasPhotos: boolean;
  uploadedPhotos: string[];
  isSharedView: boolean;
}

const MAX_PHOTOS = 5;

export const UIOverlay: React.FC<UIOverlayProps> = ({ mode, onToggle, onPhotosUpload, hasPhotos, uploadedPhotos, isSharedView }) => {
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
    const readers = filesToRead.map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          resolve(event.target.result);
        } else {
          reject(new Error(`Không thể đọc tệp ${file.name}`));
        }
      };
      reader.onerror = () => reject(new Error(`Không thể đọc tệp ${file.name}`));
      reader.readAsDataURL(file);
    }));

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

  // Helper function to convert base64 to Blob
  const base64ToBlob = (base64: string): Blob => {
    const byteString = atob(base64.split(',')[1]);
    const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  };

  const handleShare = async () => {
    if (!uploadedPhotos || uploadedPhotos.length === 0) {
      setShareError('Vui lòng tải ảnh lên trước');
      return;
    }

    setIsSharing(true);
    setShareError('');
    setShareLink('');
    setUploadProgress('Đang chuẩn bị tải lên...');

    try {
      // Step 1: Get presigned upload URLs from server
      setUploadProgress('Đang lấy liên kết tải lên...');
      const urlsResponse = await fetch('/api/get-upload-urls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageCount: uploadedPhotos.length,
        }),
      });

      // If API returns 404, use localStorage fallback
      if (urlsResponse.status === 404) {
        const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1');
        
        if (isLocalDev) {
          console.log('API not available, using localStorage fallback');
          try {
            const shareId = Math.random().toString(36).substring(2, 10);
            const shareData = {
              images: uploadedPhotos,
              createdAt: Date.now(),
            };
            localStorage.setItem(`share_${shareId}`, JSON.stringify(shareData));
            const shareLink = `${window.location.origin}/?share=${shareId}`;
            setShareLink(shareLink);
            return;
          } catch (storageError: any) {
            setShareError('Dung lượng ảnh quá lớn, vui lòng giảm số lượng hoặc kích thước ảnh');
            return;
          }
        } else {
          throw new Error('Chưa cấu hình API, vui lòng kiểm tra cài đặt triển khai');
        }
      }

      const urlsData = await urlsResponse.json();

      if (!urlsResponse.ok) {
        throw new Error(urlsData.error || 'Lấy liên kết tải lên thất bại');
      }

      const { shareId, uploadUrls } = urlsData;

      // Step 2: Upload images directly to R2 using presigned URLs
      setUploadProgress(`Đang tải ảnh lên (0/${uploadedPhotos.length})...`);
      
      let uploadedCount = 0;
      const uploadPromises = uploadedPhotos.map(async (photo, index) => {
        const blob = base64ToBlob(photo);
        const { uploadUrl, publicUrl } = uploadUrls[index];

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: {
            'Content-Type': 'image/jpeg',
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Tải ảnh thứ ${index + 1} thất bại`);
        }

        uploadedCount++;
        setUploadProgress(`Đang tải ảnh lên (${uploadedCount}/${uploadedPhotos.length})...`);
        return publicUrl;
      });

      const imageUrls = await Promise.all(uploadPromises);

      // Step 3: Complete the upload by storing metadata in KV
      setUploadProgress('Đang tạo liên kết chia sẻ...');
      const completeResponse = await fetch('/api/complete-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shareId,
          imageUrls,
        }),
      });

      const completeData = await completeResponse.json();

      if (!completeResponse.ok) {
        throw new Error(completeData.error || 'Lưu thông tin chia sẻ thất bại');
      }

      setShareLink(completeData.shareLink);
    } catch (error: any) {
      console.error('Share error:', error);
      
      // Fallback to localStorage for network errors
      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1');
      
      if (isLocalDev && (error.message?.includes('Failed to fetch') || error.name === 'TypeError')) {
        try {
          console.log('Network error, using localStorage fallback');
          const shareId = Math.random().toString(36).substring(2, 10);
          const shareData = {
            images: uploadedPhotos,
            createdAt: Date.now(),
          };
          localStorage.setItem(`share_${shareId}`, JSON.stringify(shareData));
          const shareLink = `${window.location.origin}/?share=${shareId}`;
          setShareLink(shareLink);
          return;
        } catch (storageError: any) {
          setShareError('Dung lượng ảnh quá lớn, vui lòng giảm số lượng hoặc kích thước ảnh');
          return;
        }
      }
      
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
      
      {/* Header */}
      <header className="absolute top-6 md:top-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center pointer-events-none select-none z-20">
        <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F5E6BF] to-[#D4AF37] font-serif drop-shadow-[0_4px_16px_rgba(212,175,55,0.4)] tracking-wider text-center whitespace-nowrap px-6 pt-2 pb-4 leading-normal">
          Merry Christmas
        </h1>
      </header>

      {/* Right Bottom Action Area */}
      <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-30 pointer-events-auto flex flex-col items-end">
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Shared View: Show "Tạo cây thông của tôi" button */}
        {isSharedView && (
          <button
            onClick={handleCreateMine}
            className="group relative flex items-center gap-3 px-6 py-3.5 rounded-xl border-2 border-[#D4AF37] bg-black/80 hover:bg-[#D4AF37]/20 backdrop-blur-md shadow-[0_0_25px_rgba(212,175,55,0.3)] hover:shadow-[0_0_35px_rgba(212,175,55,0.5)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg className="w-5 h-5 text-[#D4AF37] group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="font-sans text-sm md:text-base font-semibold text-[#D4AF37] tracking-wider group-hover:text-white transition-colors">
              {t('createMine')}
            </span>
          </button>
        )}

        {/* Not Shared View: Show upload and share controls */}
        {!isSharedView && (
          <>
            {/* When NO photos uploaded yet: Big attractive Upload Button */}
            {!hasPhotos && (
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={handleUploadClick}
                  className="group relative flex items-center gap-3.5 px-6 py-3.5 rounded-xl border-2 border-[#D4AF37] bg-gradient-to-r from-black/90 via-[#181404]/90 to-black/90 backdrop-blur-md shadow-[0_0_25px_rgba(212,175,55,0.3)] hover:shadow-[0_0_35px_rgba(212,175,55,0.6)] hover:border-[#F5E6BF] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/50 flex items-center justify-center group-hover:bg-[#D4AF37]/35 group-hover:scale-105 transition-all">
                    <svg className="w-5 h-5 text-[#F5E6BF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-sans text-sm md:text-base font-semibold text-[#F5E6BF] tracking-wide group-hover:text-white transition-colors">
                      {language === 'vi' ? 'Tải ảnh lên' : 'Upload Photos'}
                    </span>
                    <span className="text-[11px] text-[#D4AF37]/80 tracking-wide font-sans">
                      {language === 'vi' ? `Tối đa ${MAX_PHOTOS} ảnh kỷ niệm` : `Max ${MAX_PHOTOS} memory photos`}
                    </span>
                  </div>
                </button>
                {uploadError && (
                  <p className="text-red-400 text-xs font-sans bg-black/80 px-3 py-1.5 rounded-lg border border-red-500/40 shadow-lg">{uploadError}</p>
                )}
              </div>
            )}

            {/* When photos ARE uploaded: Refined Control Panel or Minimized Pill */}
            {hasPhotos && (
              <div className="flex flex-col items-end gap-2 w-full max-w-[340px] sm:max-w-[380px]">
                {isPanelMinimized ? (
                  /* Minimized Floating Pill Button (Windows Taskbar style) */
                  <button
                    onClick={() => setIsPanelMinimized(false)}
                    className="group relative flex items-center gap-2.5 px-3.5 py-2 rounded-lg border border-[#D4AF37]/70 bg-black/90 hover:bg-[#D4AF37]/20 backdrop-blur-md shadow-[0_0_20px_rgba(212,175,55,0.3)] text-[#F5E6BF] hover:text-white transition-all duration-200 cursor-pointer"
                    title="Phóng to / Mở lại bảng"
                  >
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4AF37]"></span>
                    </span>

                    {/* Preview avatar */}
                    {uploadedPhotos.length > 0 && (
                      <img
                        src={uploadedPhotos[uploadedPhotos.length - 1]}
                        alt="preview"
                        className="inline-block h-5 w-5 rounded ring-1 ring-[#D4AF37]/60 object-cover"
                      />
                    )}

                    <span className="font-sans text-xs font-medium tracking-wide">
                      {t('uploadedCount')}: <strong className="text-[#D4AF37] font-semibold">{uploadedPhotos.length}</strong>/{MAX_PHOTOS}
                    </span>

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
                  <div className="w-full bg-black/85 backdrop-blur-xl border border-[#D4AF37]/70 rounded-2xl p-4 shadow-[0_0_30px_rgba(212,175,55,0.25)] flex flex-col gap-3 transition-all">
                    
                    {/* Panel Header: Photo count, preview thumbnails, Windows-style "-" and "✕" buttons */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#D4AF37]/25">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4AF37]"></span>
                        </span>
                        <span className="font-sans text-xs text-[#F5E6BF] tracking-wide">
                          {t('uploadedCount')}: <strong className="text-[#D4AF37] text-sm font-semibold">{uploadedPhotos.length}</strong>/{MAX_PHOTOS}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Mini preview thumbnails */}
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

                        {/* Trash Can Button - Delete all photos */}
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

                  {/* Actions Grid: [Thêm ảnh] & [Tạo link chia sẻ] */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Nút Thêm ảnh */}
                    <button
                      onClick={handleUploadClick}
                      disabled={uploadedPhotos.length >= MAX_PHOTOS}
                      className="group relative flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-[#D4AF37]/50 bg-black/60 hover:bg-[#D4AF37]/15 hover:border-[#D4AF37] text-[#D4AF37] hover:text-[#fff] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                    >
                      <svg className="w-4 h-4 text-[#D4AF37] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      <span className="font-sans text-xs md:text-sm font-medium tracking-wide whitespace-nowrap">
                        {uploadedPhotos.length >= MAX_PHOTOS ? t('maxPhotosReached') : (language === 'vi' ? 'Thêm ảnh' : 'Add Photo')}
                      </span>
                    </button>

                    {/* Nút Tạo link chia sẻ */}
                    <button
                      onClick={handleShare}
                      disabled={isSharing}
                      className="group relative flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-[#D4AF37] bg-gradient-to-r from-[#D4AF37]/25 via-[#F5E6BF]/30 to-[#D4AF37]/25 hover:from-[#D4AF37]/45 hover:via-[#F5E6BF]/45 hover:to-[#D4AF37]/45 text-[#F5E6BF] hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)]"
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
                          <span className="font-sans text-xs md:text-sm font-semibold tracking-wide whitespace-nowrap">
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
          </>
        )}
      </div>
    </div>
  );
};