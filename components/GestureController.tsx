import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';
import { TreeMode, ActiveTrack } from '../types';
import { MaskType, MASK_OPTIONS, FaceMaskRenderer, MASK_METRICS } from './FaceMasks';
import { useLanguage } from '../context/LanguageContext';
import { useDeviceType } from '../hooks/useDeviceType';
import { LanguageToggle } from './LanguageToggle';
import { MusicPlayer } from './MusicPlayer';

interface GestureControllerProps {
  onModeChange: (mode: TreeMode) => void;
  currentMode: TreeMode;
  onHandPosition?: (x: number, y: number, detected: boolean) => void;
  onTwoHandsDetected?: (detected: boolean) => void;
  onPhotoFingerSelect?: (photoIndex: number | null) => void;
  selectedPhotoIndex?: number | null;
  currentMask?: MaskType;
  onMaskChange?: (mask: MaskType) => void;
  currentMusic?: ActiveTrack | null;
  onMusicChange?: (track: ActiveTrack | null) => void;
}

export interface FingerDetectionResult {
  count: number;
  fingers: {
    thumb: boolean;
    index: boolean;
    middle: boolean;
    ring: boolean;
    pinky: boolean;
  };
}

/**
 * Robust, scale-invariant MediaPipe finger extension detector.
 * Returns exact extended finger count (0 to 5) and individual finger states.
 */
export function countExtendedFingers(landmarks: any[]): FingerDetectionResult {
  if (!landmarks || landmarks.length < 21) {
    return {
      count: 0,
      fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
    };
  }

  const wrist = landmarks[0];

  const checkFinger = (tipIdx: number, pipIdx: number, mcpIdx: number) => {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const mcp = landmarks[mcpIdx];

    const distTipWrist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const distPipWrist = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    const distTipMcp = Math.hypot(tip.x - mcp.x, tip.y - mcp.y);
    const distPipMcp = Math.hypot(pip.x - mcp.x, pip.y - mcp.y);

    return distTipWrist > distPipWrist * 1.06 && distTipMcp > distPipMcp * 1.06;
  };

  const isIndex = checkFinger(8, 6, 5);
  const isMiddle = checkFinger(12, 10, 9);
  const isRing = checkFinger(16, 14, 13);
  const isPinky = checkFinger(20, 18, 17);

  const thumbTip = landmarks[4];
  const thumbIP = landmarks[3];
  const thumbMCP = landmarks[2];
  const indexMCP = landmarks[5];
  const pinkyMCP = landmarks[17];

  const palmWidth = Math.hypot(indexMCP.x - pinkyMCP.x, indexMCP.y - pinkyMCP.y);
  const distTipPinky = Math.hypot(thumbTip.x - pinkyMCP.x, thumbTip.y - pinkyMCP.y);
  const distIpPinky = Math.hypot(thumbIP.x - pinkyMCP.x, thumbIP.y - pinkyMCP.y);
  const distTipIndex = Math.hypot(thumbTip.x - indexMCP.x, thumbTip.y - indexMCP.y);
  const distTipWrist = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y);
  const distMcpWrist = Math.hypot(thumbMCP.x - wrist.x, thumbMCP.y - wrist.y);

  const isClosedThumb =
    distTipPinky < distIpPinky * 0.98 ||
    (distTipWrist < distMcpWrist * 1.15 && distTipIndex < palmWidth * 0.55);
  const isThumb = !isClosedThumb;

  const count = [isThumb, isIndex, isMiddle, isRing, isPinky].filter(Boolean).length;

  return {
    count,
    fingers: {
      thumb: isThumb,
      index: isIndex,
      middle: isMiddle,
      ring: isRing,
      pinky: isPinky,
    },
  };
}

export interface AnalyzedGesture {
  isPinchClose: boolean;
  isPinchOpen: boolean;
  photoSelect: number | null;
}

/**
 * Classifies the user's hand gesture with absolute mathematical clarity.
 * Completely eliminates conflicts:
 * - Spreading thumb + index is strictly recognized as Pinch Open (Tree Chaos), NEVER Photo 2.
 * - Photo 2 strictly requires Peace sign ✌️ (index + middle open, thumb folded).
 * - Photo 5 (all 5 fingers open) strictly opens photo 5, and NEVER triggers Tree Chaos.
 */
export function analyzeHandLandmarks(landmarks: any[]): AnalyzedGesture {
  if (!landmarks || landmarks.length < 21) {
    return { isPinchClose: false, isPinchOpen: false, photoSelect: null };
  }

  const detection = countExtendedFingers(landmarks);
  const { fingers, count } = detection;

  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const handScale = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.2;

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
  const pinchRatio = pinchDist / handScale;

  // 1. PINCH CLOSE (Co ngón cái & trỏ lại với nhau -> Thu cây thông)
  const isPinchClose = pinchRatio < 0.35;

  // 2. PINCH OPEN (Tách ngón cái & trỏ ra để bung tán cây thông)
  // Thumb and Index must be open, pinchRatio wide, and NOT all 5 fingers open
  const isPinchOpen =
    pinchRatio > 0.82 &&
    fingers.thumb &&
    fingers.index &&
    (!fingers.pinky || !fingers.ring);

  // 3. PHOTO SELECTION (1 - 5, or 0 for close)
  let photoSelect: number | null = null;

  // Photo 5: All 5 fingers extended
  if (count === 5 || (fingers.thumb && fingers.index && fingers.middle && fingers.ring && fingers.pinky)) {
    photoSelect = 5;
  }
  // Photo 4: 4 fingers (Index, Middle, Ring, Pinky), Thumb folded
  else if (fingers.index && fingers.middle && fingers.ring && fingers.pinky && !fingers.thumb) {
    photoSelect = 4;
  }
  // Photo 3: 3 fingers (Index, Middle, Ring), Pinky folded
  else if (fingers.index && fingers.middle && fingers.ring && !fingers.pinky) {
    photoSelect = 3;
  }
  // Photo 2: Peace sign ✌️ (Index + Middle extended, Thumb folded, Ring & Pinky folded)
  else if (fingers.index && fingers.middle && !fingers.thumb && !fingers.ring && !fingers.pinky) {
    photoSelect = 2;
  }
  // Photo 1: Index finger extended ONLY (Thumb, Middle, Ring, Pinky folded)
  else if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky && !fingers.thumb) {
    photoSelect = 1;
  }
  // Clenched fist (all fingers folded) -> close photo
  else if (count === 0 || (!fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky)) {
    photoSelect = 0;
  }

  return {
    isPinchClose,
    isPinchOpen,
    photoSelect,
  };
}

export const GestureController: React.FC<GestureControllerProps> = ({
  onModeChange,
  currentMode,
  onTwoHandsDetected,
  onPhotoFingerSelect,
  selectedPhotoIndex,
  currentMask = 'none',
  onMaskChange,
  currentMusic = null,
  onMusicChange,
}) => {
  const { t } = useLanguage();
  const { isMobile } = useDeviceType();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraBoxRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isCameraMinimized, setIsCameraMinimized] = useState(false);

  // Dynamic prop callback refs to avoid stale closures in requestAnimationFrame loop
  const onModeChangeRef = useRef(onModeChange);
  const onTwoHandsDetectedRef = useRef(onTwoHandsDetected);
  const onPhotoFingerSelectRef = useRef(onPhotoFingerSelect);
  const lastModeRef = useRef<TreeMode>(currentMode);
  const isMobileRef = useRef(isMobile);

  useEffect(() => {
    onModeChangeRef.current = onModeChange;
    onTwoHandsDetectedRef.current = onTwoHandsDetected;
    onPhotoFingerSelectRef.current = onPhotoFingerSelect;
    isMobileRef.current = isMobile;
  });

  useEffect(() => {
    lastModeRef.current = currentMode;
  }, [currentMode]);

  // When photo overlay is closed, reset confirmed photo so it can be reopened immediately
  useEffect(() => {
    if (selectedPhotoIndex === null || selectedPhotoIndex === undefined) {
      lastConfirmedPhotoRef.current = null;
      candidateFingersRef.current = null;
      candidateFramesRef.current = 0;
    }
  }, [selectedPhotoIndex]);

  // Face Mask states (for Desktop Web)
  const [selectedMask, setSelectedMask] = useState<MaskType>(currentMask || 'none');
  const [isMaskPopupOpen, setIsMaskPopupOpen] = useState(false);
  const [faceTransform, setFaceTransform] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    angle: number;
    detected: boolean;
  }>({
    x: 50,
    y: 45,
    width: 60,
    height: 70,
    angle: 0,
    detected: false,
  });

  const selectedMaskRef = useRef<MaskType>(selectedMask);
  const smoothedFaceRef = useRef({
    x: 50,
    y: 45,
    width: 60,
    height: 70,
    angle: 0,
    detected: false,
  });
  const lostFaceFrames = useRef(0);

  useEffect(() => {
    if (currentMask !== undefined) {
      setSelectedMask(currentMask);
    }
  }, [currentMask]);

  useEffect(() => {
    selectedMaskRef.current = selectedMask;
    if (selectedMask === 'none') {
      smoothedFaceRef.current.detected = false;
      setFaceTransform((prev) => ({ ...prev, detected: false }));
    }
  }, [selectedMask]);

  // Close mask popup on click outside (Desktop)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        cameraBoxRef.current &&
        !cameraBoxRef.current.contains(e.target as Node)
      ) {
        setIsMaskPopupOpen(false);
      }
    };
    if (isMaskPopupOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMaskPopupOpen]);

  // Debounce refs
  const pinchCloseFramesRef = useRef(0);
  const pinchOpenFramesRef = useRef(0);
  const CONFIRM_THRESHOLD = 3;

  const candidateFingersRef = useRef<number | null>(null);
  const candidateFramesRef = useRef(0);
  const lastConfirmedPhotoRef = useRef<number | null>(null);
  const noHandFramesRef = useRef(0);
  const PHOTO_CONFIRM_THRESHOLD = 4;

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let faceLandmarker: FaceLandmarker | null = null;
    let animationFrameId: number;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
        );

        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `/models/hand_landmarker.task`,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });

        // Initialize FaceLandmarker on Desktop for AR filters
        if (!isMobileRef.current) {
          try {
            faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: `/models/face_landmarker.task`,
                delegate: 'GPU',
              },
              runningMode: 'VIDEO',
              numFaces: 1,
            });
          } catch (faceErr) {
            console.warn('FaceLandmarker GPU init failed, trying CPU:', faceErr);
            try {
              faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                  modelAssetPath: `/models/face_landmarker.task`,
                  delegate: 'CPU',
                },
                runningMode: 'VIDEO',
                numFaces: 1,
              });
            } catch (cpuErr) {
              console.warn('FaceLandmarker disabled:', cpuErr);
            }
          }
        }

        startWebcam();
      } catch (error) {
        console.warn('GPU HandLandmarker init failed, falling back to CPU:', error);
        try {
          const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
          );
          handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: `/models/hand_landmarker.task`,
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
          });
          startWebcam();
        } catch (cpuError) {
          console.error('HandLandmarker init failed completely:', cpuError);
        }
      }
    };

    const startWebcam = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: 'user' },
          });

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener('loadeddata', predictWebcam);
            setIsLoaded(true);
          }
        } catch (err) {
          console.warn('Webcam access was not granted:', err);
        }
      }
    };

    // Draw skeleton on desktop camera box
    const drawSingleHandSkeleton = (
      landmarks: any[],
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      lineColor: string = '#D4AF37',
      pointColor: string = '#10B981'
    ) => {
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
        [5, 9], [9, 13], [13, 17],
      ];

      ctx.lineWidth = 2;
      ctx.strokeStyle = lineColor;
      connections.forEach(([start, end]) => {
        const p1 = landmarks[start];
        const p2 = landmarks[end];
        ctx.beginPath();
        ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
        ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
        ctx.stroke();
      });

      landmarks.forEach((lm) => {
        ctx.beginPath();
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = pointColor;
        ctx.fill();
      });
    };

    const predictWebcam = () => {
      if (!handLandmarker || !videoRef.current) return;

      const startTimeMs = performance.now();
      if (videoRef.current.videoWidth > 0) {
        const result = handLandmarker.detectForVideo(videoRef.current, startTimeMs);

        if (result.landmarks && result.landmarks.length > 0) {
          noHandFramesRef.current = 0;
          const numHands = result.landmarks.length;
          if (onTwoHandsDetectedRef.current) {
            onTwoHandsDetectedRef.current(numHands >= 2);
          }

          // Draw skeleton on desktop camera box
          if (!isMobileRef.current && canvasRef.current && videoRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              result.landmarks.forEach((lms, idx) => {
                const lineColor = idx === 0 ? '#D4AF37' : '#38BDF8';
                const pointColor = idx === 0 ? '#10B981' : '#F43F5E';
                drawSingleHandSkeleton(lms, ctx, canvas, lineColor, pointColor);
              });
            }
          }

          // Perform unified, conflict-free gesture analysis on primary hand
          const primaryLm = result.landmarks[0];
          const { isPinchClose, isPinchOpen, photoSelect } = analyzeHandLandmarks(primaryLm);

          // 1. Process Tree Mode Latching (Pinch Close / Pinch Open)
          if (isPinchClose) {
            pinchCloseFramesRef.current++;
            pinchOpenFramesRef.current = 0;
            if (pinchCloseFramesRef.current >= CONFIRM_THRESHOLD) {
              if (lastModeRef.current !== TreeMode.FORMED) {
                lastModeRef.current = TreeMode.FORMED;
                onModeChangeRef.current(TreeMode.FORMED);
              }
            }
          } else if (isPinchOpen) {
            pinchOpenFramesRef.current++;
            pinchCloseFramesRef.current = 0;
            if (pinchOpenFramesRef.current >= CONFIRM_THRESHOLD) {
              if (lastModeRef.current !== TreeMode.CHAOS) {
                lastModeRef.current = TreeMode.CHAOS;
                onModeChangeRef.current(TreeMode.CHAOS);
              }
            }
          } else {
            pinchCloseFramesRef.current = 0;
            pinchOpenFramesRef.current = 0;
          }

          // 2. Process Photo Selection (1..5 or 0 for close)
          if (candidateFingersRef.current === photoSelect) {
            candidateFramesRef.current++;
          } else {
            candidateFingersRef.current = photoSelect;
            candidateFramesRef.current = 1;
          }

          if (candidateFramesRef.current >= PHOTO_CONFIRM_THRESHOLD) {
            if (photoSelect !== null && photoSelect >= 1 && photoSelect <= 5) {
              if (lastConfirmedPhotoRef.current !== photoSelect) {
                lastConfirmedPhotoRef.current = photoSelect;
                if (onPhotoFingerSelectRef.current) {
                  onPhotoFingerSelectRef.current(photoSelect);
                }
              }
            } else if (photoSelect === 0) {
              // Fist closes active photo
              if (lastConfirmedPhotoRef.current !== null) {
                lastConfirmedPhotoRef.current = null;
                if (onPhotoFingerSelectRef.current) {
                  onPhotoFingerSelectRef.current(null);
                }
              }
            }
          }
        } else {
          // No hand detected
          noHandFramesRef.current++;
          pinchCloseFramesRef.current = 0;
          pinchOpenFramesRef.current = 0;
          candidateFingersRef.current = null;
          candidateFramesRef.current = 0;

          if (noHandFramesRef.current > 8) {
            if (onTwoHandsDetectedRef.current) {
              onTwoHandsDetectedRef.current(false);
            }
            if (lastConfirmedPhotoRef.current !== null) {
              lastConfirmedPhotoRef.current = null;
              if (onPhotoFingerSelectRef.current) {
                onPhotoFingerSelectRef.current(null);
              }
            }
          }

          if (!isMobileRef.current && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
          }
        }

        // Desktop Real-time AR Face Filter Tracking
        if (!isMobileRef.current && faceLandmarker && selectedMaskRef.current !== 'none') {
          try {
            const faceResult = faceLandmarker.detectForVideo(videoRef.current, startTimeMs);
            if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
              lostFaceFrames.current = 0;
              const landmarks = faceResult.faceLandmarks[0];

              const forehead = landmarks[10];
              const chin = landmarks[152];
              const leftCheek = landmarks[234];
              const rightCheek = landmarks[454];

              const dx = rightCheek.x - leftCheek.x;
              const dy = rightCheek.y - leftCheek.y;
              const faceWidth = Math.hypot(dx, dy);

              const hx = chin.x - forehead.x;
              const hy = chin.y - forehead.y;
              const faceHeight = Math.hypot(hx, hy);

              const rawAngle = Math.atan2(dy, dx);
              const targetAngle = -rawAngle * (180 / Math.PI);

              const rawCx = (leftCheek.x + rightCheek.x) / 2;
              const rawCy = (forehead.y + chin.y) / 2;

              const metrics = MASK_METRICS[selectedMaskRef.current] || MASK_METRICS.santa;
              const offsetCy = rawCy + (chin.y - forehead.y) * metrics.yOffsetPct;

              const targetX = (1 - rawCx) * 100;
              const targetY = offsetCy * 100;
              const targetW = faceWidth * metrics.widthMultiplier * 100;
              const targetH = faceHeight * metrics.heightMultiplier * 100;

              const s = smoothedFaceRef.current;
              const alpha = s.detected ? 0.45 : 1.0;
              s.x += (targetX - s.x) * alpha;
              s.y += (targetY - s.y) * alpha;
              s.width += (targetW - s.width) * alpha;
              s.height += (targetH - s.height) * alpha;
              s.angle += (targetAngle - s.angle) * alpha;
              s.detected = true;

              setFaceTransform({ ...s });
            } else {
              lostFaceFrames.current++;
              if (lostFaceFrames.current > 15) {
                smoothedFaceRef.current.detected = false;
                setFaceTransform((prev) => ({ ...prev, detected: false }));
              }
            }
          } catch (e) {
            // Safe frame drop
          }
        }
      }

      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    setupMediaPipe();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (handLandmarker) handLandmarker.close();
      if (faceLandmarker) faceLandmarker.close();
    };
  }, []);

  return (
    <>
      {/* 
        MOBILE RENDERING:
        Hidden video and canvas in background.
        Clean top-right bar with LanguageToggle and MusicPlayer.
      */}
      {isMobile ? (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="hidden" />
          <canvas ref={canvasRef} className="hidden" />

          <div className="fixed top-3 right-3 z-50 flex items-center gap-1.5 pointer-events-auto select-none">
            <LanguageToggle />
            <MusicPlayer track={currentMusic} onTrackChange={onMusicChange} />
          </div>
        </>
      ) : (
        /* 
          DESKTOP WEB RENDERING:
          Full interactive camera station with AR Face Filters,
          Hand Skeleton visualizer, and minimizable camera box!
        */
        <div className="fixed top-6 right-6 md:right-8 z-50 flex items-start gap-2.5 pointer-events-none select-none">
          <div className="pointer-events-auto flex items-center gap-2">
            <LanguageToggle />
            <MusicPlayer track={currentMusic} onTrackChange={onMusicChange} />
          </div>

          <div className="pointer-events-auto flex flex-col items-end relative">
            {isCameraMinimized && (
              <button
                onClick={() => setIsCameraMinimized(false)}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#D4AF37]/70 bg-black/90 hover:bg-[#D4AF37]/20 backdrop-blur-md shadow-[0_0_15px_rgba(212,175,55,0.25)] text-[#F5E6BF] hover:text-white text-xs font-sans transition-all cursor-pointer"
                title={t('maximizeCamera')}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{t('cameraTitle')}</span>
                <div className="w-4 h-4 rounded flex items-center justify-center bg-white/10 group-hover:bg-[#D4AF37]/30 transition-colors ml-0.5">
                  <svg className="w-2.5 h-2.5 text-[#D4AF37]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
                  </svg>
                </div>
              </button>
            )}

            <div
              ref={cameraBoxRef}
              className={`relative w-28 h-[84px] md:w-[130px] md:h-[98px] border-2 border-[#D4AF37] rounded-lg overflow-hidden shadow-[0_0_20px_rgba(212,175,55,0.3)] bg-black transition-all ${
                isCameraMinimized ? 'hidden' : 'block'
              }`}
            >
              <div className="absolute inset-0 border border-[#F5E6BF]/20 m-1 rounded-sm z-10 pointer-events-none"></div>

              {/* Minimize & AR Filter buttons */}
              <div className="absolute top-1 right-1 z-30 pointer-events-auto flex flex-col gap-1">
                <button
                  onClick={() => {
                    setIsCameraMinimized(true);
                    setIsMaskPopupOpen(false);
                  }}
                  title={t('minimizeCamera')}
                  className="w-5 h-5 rounded flex items-center justify-center bg-black/70 hover:bg-white/20 text-[#D4AF37] hover:text-white border border-[#D4AF37]/30 hover:border-[#D4AF37] transition-all cursor-pointer"
                >
                  <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="2" y="7.5" width="12" height="1.8" rx="0.5" />
                  </svg>
                </button>

                <button
                  onClick={() => setIsMaskPopupOpen((prev) => !prev)}
                  title={t('faceMaskBtnTitle')}
                  className={`w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer ${
                    selectedMask !== 'none' || isMaskPopupOpen
                      ? 'bg-[#D4AF37] text-black shadow-[0_0_10px_rgba(212,175,55,0.6)]'
                      : 'bg-black/70 hover:bg-white/20 text-[#D4AF37] hover:text-white border border-[#D4AF37]/30 hover:border-[#D4AF37]'
                  }`}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </button>
              </div>

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-1000 ${
                  isLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />

              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none z-20"
              />

              {/* Automatic AR Face Filter Overlay */}
              {selectedMask !== 'none' && faceTransform.detected && (
                <div
                  className="absolute z-25 pointer-events-none select-none transition-transform duration-75 ease-out"
                  style={{
                    left: `${faceTransform.x}%`,
                    top: `${faceTransform.y}%`,
                    width: `${faceTransform.width}%`,
                    height: `${faceTransform.height}%`,
                    transform: `translate(-50%, -50%) rotate(${faceTransform.angle}deg)`,
                    transformOrigin: 'center center',
                  }}
                >
                  <FaceMaskRenderer mask={selectedMask} />
                </div>
              )}
            </div>

            {/* Desktop AR Face Mask Selection Popup */}
            {isMaskPopupOpen && !isCameraMinimized && (
              <div
                ref={popupRef}
                className="absolute top-full right-0 mt-2 w-72 p-3 bg-black/95 backdrop-blur-md border-2 border-[#D4AF37] rounded-xl shadow-[0_0_25px_rgba(212,175,55,0.4)] z-50 pointer-events-auto animate-scale-in"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#D4AF37]/30">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎭</span>
                    <span className="font-sans text-xs font-bold text-[#F5E6BF] tracking-wide">
                      {t('faceMaskPopupTitle')}
                    </span>
                  </div>

                  <button
                    onClick={() => setIsMaskPopupOpen(false)}
                    className="w-5 h-5 rounded flex items-center justify-center text-[#D4AF37] hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs"
                    title={t('faceMaskClose')}
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {MASK_OPTIONS.map((opt) => {
                    const isActive = selectedMask === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setSelectedMask(opt.id);
                          onMaskChange?.(opt.id);
                        }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                          isActive
                            ? 'border-[#D4AF37] bg-[#D4AF37]/25 shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                            : 'border-[#D4AF37]/20 bg-white/5 hover:bg-white/10 hover:border-[#D4AF37]/50'
                        }`}
                      >
                        <span className="text-lg flex-shrink-0">{opt.emoji}</span>
                        <div className="flex flex-col min-w-0">
                          <span className={`text-[11px] font-sans font-semibold truncate ${isActive ? 'text-[#F5E6BF]' : 'text-gray-200'}`}>
                            {opt.label}
                          </span>
                          <span className="text-[9px] text-[#D4AF37]/70 font-sans truncate">
                            {opt.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
