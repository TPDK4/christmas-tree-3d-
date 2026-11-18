
import React, { useState, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { Experience } from './components/Experience';
import { UIOverlay } from './components/UIOverlay';
import { GestureController } from './components/GestureController';
import { InstructionGuide } from './components/InstructionGuide';
import { TreeMode } from './types';
import { getPhotoByIndex } from './utils/defaultPhotos';
import { LanguageProvider, useLanguage } from './context/LanguageContext';

// Simple Error Boundary to catch 3D resource loading errors (like textures)
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Error loading 3D scene:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can customize this fallback UI
      return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 text-[#D4AF37] font-serif p-8 text-center">
          <div>
            <h2 className="text-2xl mb-2">Something went wrong</h2>
            <p className="opacity-70">A resource failed to load (likely a missing image). Check the console for details.</p>
            <button 
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 px-4 py-2 border border-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<TreeMode>(TreeMode.FORMED);
  const [handPosition, setHandPosition] = useState<{ x: number; y: number; detected: boolean }>({ x: 0.5, y: 0.5, detected: false });
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isLoadingShare, setIsLoadingShare] = useState(false);
  const [isSharedView, setIsSharedView] = useState(false);
  const [twoHandsDetected, setTwoHandsDetected] = useState(false);
  const [closestPhoto, setClosestPhoto] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [selectedPhotoTitle, setSelectedPhotoTitle] = useState<string>('');

  // Check for share parameter in URL on mount
  useEffect(() => {
    const loadSharedPhotos = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const shareId = urlParams.get('share');

      if (!shareId) return;

      setIsSharedView(true);
      setIsLoadingShare(true);

      try {
        // Try API first (works in vercel dev and production)
        try {
          const response = await fetch(`/api/share?id=${shareId}`);
          const data = await response.json();

          if (response.ok && data.success) {
            setUploadedPhotos(data.images);
            return;
          }
        } catch (apiError) {
          console.log('API not available, trying localStorage fallback');
        }

        // Fallback to localStorage if API fails (pure vite dev mode)
        const shareDataStr = localStorage.getItem(`share_${shareId}`);
        if (shareDataStr) {
          const shareData = JSON.parse(shareDataStr);
          setUploadedPhotos(shareData.images);
        } else {
          console.error('Share not found');
        }
      } catch (error) {
        console.error('Error loading shared photos:', error);
      } finally {
        setIsLoadingShare(false);
      }
    };

    loadSharedPhotos();
  }, []);

  // Update photo if uploaded photos change while a photo is currently open
  useEffect(() => {
    if (selectedPhotoIndex !== null) {
      const photoInfo = getPhotoByIndex(selectedPhotoIndex, uploadedPhotos);
      setClosestPhoto(photoInfo.url);
      setSelectedPhotoTitle(photoInfo.title || 'Merry Christmas');
    }
  }, [uploadedPhotos, selectedPhotoIndex]);

  const toggleMode = () => {
    setMode((prev) => (prev === TreeMode.FORMED ? TreeMode.CHAOS : TreeMode.FORMED));
  };

  const handleHandPosition = (x: number, y: number, detected: boolean) => {
    setHandPosition({ x, y, detected });
  };

  const handleTwoHandsDetected = (detected: boolean) => {
    setTwoHandsDetected(detected);
  };

  // Called when Photo Hand detects 1..5 fingers (opens photo 1..5) or 0 fingers (closes photo)
  const handlePhotoFingerSelect = (index: number | null) => {
    setSelectedPhotoIndex(index);
    if (index !== null) {
      const photoInfo = getPhotoByIndex(index, uploadedPhotos);
      setClosestPhoto(photoInfo.url);
      setSelectedPhotoTitle(photoInfo.title || 'Merry Christmas');
    } else {
      setClosestPhoto(null);
      setSelectedPhotoTitle('');
    }
  };

  const handlePhotosUpload = (photos: string[]) => {
    setUploadedPhotos(photos);
  };

  return (
    <div className="w-full h-screen relative bg-gradient-to-b from-black via-[#001a0d] to-[#0a2f1e]">
      <ErrorBoundary>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 4.0, 16.2], fov: 45 }}
          gl={{ antialias: false, stencil: false, alpha: false }}
          shadows
        >
          <Suspense fallback={null}>
            <Experience 
              mode={mode} 
              handPosition={handPosition} 
              uploadedPhotos={uploadedPhotos} 
              twoHandsDetected={twoHandsDetected} 
              selectedPhotoIndex={selectedPhotoIndex}
            />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
      
      <Loader 
        containerStyles={{ background: '#000' }} 
        innerStyles={{ width: '300px', height: '10px', background: '#333' }}
        barStyles={{ background: '#D4AF37', height: '10px' }}
        dataStyles={{ color: '#D4AF37', fontFamily: 'Cinzel' }}
      />
      
      <UIOverlay 
        mode={mode} 
        onToggle={toggleMode} 
        onPhotosUpload={handlePhotosUpload} 
        hasPhotos={uploadedPhotos.length > 0}
        uploadedPhotos={uploadedPhotos}
        isSharedView={isSharedView}
      />
      
      {/* Loading indicator for shared photos */}
      {isLoadingShare && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="text-[#D4AF37] font-sans font-medium text-xl">
            {t('loadingShared')}
          </div>
        </div>
      )}
      
      {/* Instruction Guide Board (Placed on the left) */}
      <InstructionGuide />

      {/* Gesture Control Module: Hand 1 controls Tree & Camera, Hand 2 controls Photos (1-5 fingers) */}
      <GestureController 
        currentMode={mode} 
        onModeChange={setMode} 
        onHandPosition={handleHandPosition} 
        onTwoHandsDetected={handleTwoHandsDetected}
        onPhotoFingerSelect={handlePhotoFingerSelect}
        selectedPhotoIndex={selectedPhotoIndex}
      />
      
      {/* Photo Overlay - Triggered when Photo Hand shows 1 to 5 fingers */}
      {closestPhoto && (
        <div 
          onClick={() => {
            setClosestPhoto(null);
            setSelectedPhotoIndex(null);
          }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-all duration-300 pointer-events-auto cursor-pointer animate-fade-in"
        >
          {/* Polaroid container */}
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative z-50 transform transition-all duration-500 ease-out animate-scale-in cursor-default"
          >
            {/* White Polaroid frame */}
            <div 
              className="bg-[#FAFAFA] p-4 pt-4 pb-6 shadow-[0_25px_60px_rgba(0,0,0,0.85)] rounded-sm border border-amber-100/40 relative" 
              style={{ width: '54vmin', maxWidth: '480px' }}
            >
              {/* Gold clip at top */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-14 h-7 bg-gradient-to-b from-[#F5E6BF] via-[#D4AF37] to-[#A37B1B] rounded-sm shadow-md border border-[#F5E6BF]/80 flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-black/30 shadow-inner"></span>
              </div>

              {/* Close Button "✕" */}
              <button
                onClick={() => {
                  setClosestPhoto(null);
                  setSelectedPhotoIndex(null);
                }}
                className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/5 hover:bg-black/15 text-gray-400 hover:text-gray-800 flex items-center justify-center text-sm transition-colors cursor-pointer"
                title={t('closePhoto')}
              >
                ✕
              </button>

              {/* Photo Image */}
              <div className="relative w-full aspect-square overflow-hidden rounded-[2px] bg-gray-100 shadow-inner border border-gray-200/80">
                <img 
                  src={closestPhoto} 
                  alt={selectedPhotoTitle || t('happyMemories')} 
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                />
              </div>
              
              {/* Caption Only (Clean Polaroid look) */}
              <div className="text-center mt-4">
                <p className="font-serif text-gray-900 text-xl font-bold tracking-wide">
                  {selectedPhotoTitle || 'Merry Christmas'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
