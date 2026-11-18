export type Language = 'vi' | 'en';

export interface Translations {
  // Common / Header
  title: string;
  langCode: string;
  langLabel: string;
  langTooltip: string;

  // Music Player
  musicBtn: string;
  musicTooltip: string;
  musicTitle: string;
  musicInputPlaceholder: string;
  musicPlayBtn: string;
  musicPauseBtn: string;
  musicStopBtn: string;
  musicClearBtn: string;
  musicNowPlaying: string;
  musicNoTrack: string;
  musicVolume: string;
  musicPresetsTitle: string;
  musicSupportedHint: string;
  musicInvalidLink: string;
  musicPlatformYoutube: string;
  musicPlatformSpotify: string;
  musicPlatformZing: string;
  musicPlatformAudio: string;
  musicPlaying: string;
  musicPaused: string;

  // Camera & Face Filter
  maximizeCamera: string;
  minimizeCamera: string;
  cameraTitle: string;
  faceMaskBtnTitle: string;
  faceMaskPopupTitle: string;
  faceMaskScanning: string;
  faceMaskTracking: string;
  faceMaskClose: string;
  faceMaskFooter: string;

  // Gestures & Instruction Guide
  guideTitle: string;
  guideOpenBtn: string;
  guideMinimizeBtn: string;
  handRightTree: string;
  handLeftPhoto: string;
  fistTree: string;
  openTree: string;
  moveTree: string;
  photoFingersHint: string;
  photoFinger1: string;
  photoFinger2: string;
  photoFinger3: string;
  photoFinger4: string;
  photoFinger5: string;
  fistPhotoClose: string;
  statusFist: string;
  statusOpen: string;
  statusRotate: string;
  statusWaiting: string;
  statusNoHand: string;

  // Bottom Tree Controls & Overlay
  unleashTree: string;
  formTree: string;
  uploadMemories: string;
  uploadedCount: string;
  createShareLink: string;
  generatingLink: string;
  copyLink: string;
  copiedLink: string;
  clearAllPhotos: string;
  createMine: string;
  loadingShared: string;
  maxPhotosReached: string;
  maxPhotosError: string;
  chooseImageFile: string;
  uploadError: string;
  photoCapacityError: string;
  closePhoto: string;
  happyMemories: string;
  // Mobile / Touch controls
  touchGuideTitle: string;
  touchRotate: string;
  touchZoom: string;
  touchTapPhoto: string;
  treeToggleUnleash: string;
  treeToggleForm: string;
}

export const translations: Record<Language, Translations> = {
  vi: {
    // Common / Header
    title: 'Merry Christmas',
    langCode: 'VI',
    langLabel: 'Tiếng Việt',
    langTooltip: 'Chuyển sang Tiếng Anh (English)',

    // Music Player
    musicBtn: 'Nhạc',
    musicTooltip: 'Bật / Phát nhạc',
    musicTitle: 'Trình Phát Nhạc Giáng Sinh',
    musicInputPlaceholder: 'Dán link YouTube, ZingMP3, Spotify hoặc MP3...',
    musicPlayBtn: 'Phát',
    musicPauseBtn: 'Tạm dừng',
    musicStopBtn: 'Dừng',
    musicClearBtn: 'Xóa',
    musicNowPlaying: 'Đang phát:',
    musicNoTrack: 'Chưa có nhạc nào được phát',
    musicVolume: 'Âm lượng',
    musicPresetsTitle: '🎄 Giai Điệu Giáng Sinh Tuyển Chọn',
    musicSupportedHint: 'Hỗ trợ link: YouTube, Spotify, ZingMP3, MP3 direct',
    musicInvalidLink: 'Link không hợp lệ hoặc chưa được hỗ trợ!',
    musicPlatformYoutube: 'YouTube',
    musicPlatformSpotify: 'Spotify',
    musicPlatformZing: 'ZingMP3',
    musicPlatformAudio: 'Tệp Âm Thanh',
    musicPlaying: 'Đang phát',
    musicPaused: 'Tạm dừng',

    // Camera & Face Filter
    maximizeCamera: 'Phóng to Camera',
    minimizeCamera: 'Thu nhỏ Camera',
    cameraTitle: 'Camera',
    faceMaskBtnTitle: 'Bộ lọc AR che mặt',
    faceMaskPopupTitle: 'Bộ Lọc AR Che Mặt',
    faceMaskScanning: 'Đang quét...',
    faceMaskTracking: 'Đang bám mặt',
    faceMaskClose: 'Đóng',
    faceMaskFooter: 'Tự động nhận diện và bám theo khuôn mặt theo thời gian thực (AR Filter)',

    // Gestures & Instruction Guide
    guideTitle: 'Hướng Dẫn Cử Chỉ',
    guideOpenBtn: 'Hướng dẫn cử chỉ',
    guideMinimizeBtn: 'Thu nhỏ bảng',
    handRightTree: 'Tay Phải • Cây Thông',
    handLeftPhoto: 'Tay Trái • Mở Ảnh',
    fistTree: 'Thu gọn cây',
    openTree: 'Bung tỏa cây',
    moveTree: 'Xoay góc nhìn 3D',
    photoFingersHint: '1 – 5 ngón',
    photoFinger1: 'Ảnh 1',
    photoFinger2: 'Ảnh 2',
    photoFinger3: 'Ảnh 3',
    photoFinger4: 'Ảnh 4',
    photoFinger5: 'Ảnh 5',
    fistPhotoClose: 'Đóng ảnh',
    statusFist: 'Nắm (Thu)',
    statusOpen: 'Xòe (Bung)',
    statusRotate: 'Xoay góc',
    statusWaiting: 'Chờ tay...',
    statusNoHand: 'Không phát hiện tay',

    // Bottom Tree Controls & Overlay
    unleashTree: 'Bung tỏa cây',
    formTree: 'Thu gọn cây',
    uploadMemories: 'Tải ảnh kỷ niệm (Tối đa 5 ảnh)',
    uploadedCount: 'Ảnh đã gắn',
    createShareLink: 'Tạo link chia sẻ',
    generatingLink: 'Đang tạo link...',
    copyLink: 'Sao chép link',
    copiedLink: 'Đã sao chép!',
    clearAllPhotos: 'Xóa tất cả ảnh',
    createMine: 'Tạo cây thông của tôi',
    loadingShared: 'Đang tải ảnh được chia sẻ...',
    maxPhotosReached: 'Đã đủ 5 ảnh',
    maxPhotosError: 'Bạn chỉ có thể tải tối đa 5 ảnh',
    chooseImageFile: 'Vui lòng chọn tệp hình ảnh',
    uploadError: 'Không thể đọc ảnh, vui lòng thử lại',
    photoCapacityError: 'Dung lượng ảnh quá lớn, vui lòng giảm kích thước',
    closePhoto: 'Đóng ảnh',
    happyMemories: 'Kỷ Niệm Đẹp',
    // Mobile / Touch controls
    touchGuideTitle: 'Thao tác Chạm (Điện thoại / Tablet)',
    touchRotate: 'Vuốt 1 ngón tay để xoay 360°',
    touchZoom: 'Chụm 2 ngón để phóng to / thu nhỏ',
    touchTapPhoto: 'Chạm vào ảnh trên cây để phóng to',
    treeToggleUnleash: '✨ Bung nở',
    treeToggleForm: '🌲 Thu gọn',
  },
  en: {
    // Common / Header
    title: 'Merry Christmas',
    langCode: 'EN',
    langLabel: 'English',
    langTooltip: 'Switch to Vietnamese (Tiếng Việt)',

    // Music Player
    musicBtn: 'Music',
    musicTooltip: 'Play Holiday Music',
    musicTitle: 'Christmas Music Player',
    musicInputPlaceholder: 'Paste YouTube, ZingMP3, Spotify or MP3 link...',
    musicPlayBtn: 'Play',
    musicPauseBtn: 'Pause',
    musicStopBtn: 'Stop',
    musicClearBtn: 'Clear',
    musicNowPlaying: 'Now Playing:',
    musicNoTrack: 'No track currently playing',
    musicVolume: 'Volume',
    musicPresetsTitle: '🎄 Handpicked Holiday Classics',
    musicSupportedHint: 'Supports: YouTube, Spotify, ZingMP3, direct MP3 links',
    musicInvalidLink: 'Invalid link or unsupported platform!',
    musicPlatformYoutube: 'YouTube',
    musicPlatformSpotify: 'Spotify',
    musicPlatformZing: 'ZingMP3',
    musicPlatformAudio: 'Audio File',
    musicPlaying: 'Playing',
    musicPaused: 'Paused',

    // Camera & Face Filter
    maximizeCamera: 'Maximize Camera',
    minimizeCamera: 'Minimize Camera',
    cameraTitle: 'Camera',
    faceMaskBtnTitle: 'AR Face Filter',
    faceMaskPopupTitle: 'AR Holiday Face Masks',
    faceMaskScanning: 'Scanning...',
    faceMaskTracking: 'Face Tracked',
    faceMaskClose: 'Close',
    faceMaskFooter: 'Real-time face tracking and automatic AR holiday mask filter',

    // Gestures & Instruction Guide
    guideTitle: 'Gesture Controls',
    guideOpenBtn: 'Gesture Guide',
    guideMinimizeBtn: 'Minimize Guide',
    handRightTree: 'Right Hand • Christmas Tree',
    handLeftPhoto: 'Left Hand • View Photos',
    fistTree: 'Collapse tree',
    openTree: 'Unleash chaos',
    moveTree: 'Rotate 3D view',
    photoFingersHint: '1 – 5 fingers',
    photoFinger1: 'Photo 1',
    photoFinger2: 'Photo 2',
    photoFinger3: 'Photo 3',
    photoFinger4: 'Photo 4',
    photoFinger5: 'Photo 5',
    fistPhotoClose: 'Close photo',
    statusFist: 'Fist (Collapse)',
    statusOpen: 'Open (Unleash)',
    statusRotate: 'Rotate 3D',
    statusWaiting: 'Waiting for hand...',
    statusNoHand: 'No hand detected',

    // Bottom Tree Controls & Overlay
    unleashTree: 'Unleash Chaos',
    formTree: 'Form Tree',
    uploadMemories: 'Upload Memories (Max 5 photos)',
    uploadedCount: 'Attached Photos',
    createShareLink: 'Create Share Link',
    generatingLink: 'Creating link...',
    copyLink: 'Copy Link',
    copiedLink: 'Copied!',
    clearAllPhotos: 'Clear all photos',
    createMine: 'Create My Tree',
    loadingShared: 'Loading shared photos...',
    maxPhotosReached: '5/5 Photos uploaded',
    maxPhotosError: 'You can upload up to 5 photos max',
    chooseImageFile: 'Please choose image files',
    uploadError: 'Failed to read photo, please try again',
    photoCapacityError: 'Photo file size too large, please reduce size',
    closePhoto: 'Close photo',
    happyMemories: 'Happy Memories',
    // Mobile / Touch controls
    touchGuideTitle: 'Touch Controls (Mobile / Tablet)',
    touchRotate: 'Swipe 1 finger to rotate 360°',
    touchZoom: 'Pinch 2 fingers to zoom in/out',
    touchTapPhoto: 'Tap photo on tree to enlarge',
    treeToggleUnleash: '✨ Unleash',
    treeToggleForm: '🌲 Form Tree',
  }
};
