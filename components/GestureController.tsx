import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { TreeMode, ActiveTrack } from '../types';
import { MaskType } from './FaceMasks';
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

  // 4 fingers: Index (8,6,5), Middle (12,10,9), Ring (16,14,13), Pinky (20,18,17)
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

  // Thumb detection
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

export const GestureController: React.FC<GestureControllerProps> = ({
  onModeChange,
  currentMode,
  onHandPosition,
  onTwoHandsDetected,
  onPhotoFingerSelect,
  selectedPhotoIndex,
  currentMusic = null,
  onMusicChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Dynamic prop callback refs to avoid stale closures in requestAnimationFrame loop
  const onModeChangeRef = useRef(onModeChange);
  const onHandPositionRef = useRef(onHandPosition);
  const onTwoHandsDetectedRef = useRef(onTwoHandsDetected);
  const onPhotoFingerSelectRef = useRef(onPhotoFingerSelect);
  const lastModeRef = useRef<TreeMode>(currentMode);

  useEffect(() => {
    onModeChangeRef.current = onModeChange;
    onHandPositionRef.current = onHandPosition;
    onTwoHandsDetectedRef.current = onTwoHandsDetected;
    onPhotoFingerSelectRef.current = onPhotoFingerSelect;
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

  // Tree Pinch Debounce logic refs (Pinch close -> Formed, Pinch open -> Chaos)
  const pinchCloseFramesRef = useRef(0);
  const pinchOpenFramesRef = useRef(0);
  const PINCH_CONFIRM_THRESHOLD = 3; // 3 consecutive frames (~100ms) to trigger mode latch

  // Photo Finger Debounce refs (Consecutive stability counter prevents rapid photo jumping)
  const candidateFingersRef = useRef<number | null>(null);
  const candidateFramesRef = useRef(0);
  const lastConfirmedPhotoRef = useRef<number | null>(null);
  const noHandFramesRef = useRef(0);
  const PHOTO_CONFIRM_THRESHOLD = 4; // 4 consecutive frames (~130ms) to confirm photo selection

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
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
          }
        } catch (err) {
          console.warn('Webcam access was not granted:', err);
        }
      }
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

          // Evaluate primary hand (single hand operation: either hand works!)
          const primaryLm = result.landmarks[0];

          // 1. Palm center coordinates for 3D Camera Pan / Rotation
          const palmX =
            (primaryLm[0].x + primaryLm[5].x + primaryLm[9].x + primaryLm[13].x + primaryLm[17].x) / 5;
          const palmY =
            (primaryLm[0].y + primaryLm[5].y + primaryLm[9].y + primaryLm[13].y + primaryLm[17].y) / 5;

          if (onHandPositionRef.current) {
            onHandPositionRef.current(palmX, palmY, true);
          }

          // 2. Scale-invariant pinch ratio (Thumb tip 4 to Index tip 8)
          const wrist = primaryLm[0];
          const middleMcp = primaryLm[9];
          const handScale = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.2;

          const thumbTip = primaryLm[4];
          const indexTip = primaryLm[8];
          const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
          const pinchRatio = pinchDist / handScale;

          const detection = countExtendedFingers(primaryLm);

          // 3. Tree Pinch Action (Single Hand)
          // Pinch Close (co ngón cái và ngón trỏ lại với nhau): Thu gọn cây thông
          if (pinchRatio < 0.35) {
            pinchCloseFramesRef.current++;
            pinchOpenFramesRef.current = 0;
            if (pinchCloseFramesRef.current >= PINCH_CONFIRM_THRESHOLD) {
              if (lastModeRef.current !== TreeMode.FORMED) {
                lastModeRef.current = TreeMode.FORMED;
                onModeChangeRef.current(TreeMode.FORMED);
              }
            }
          }
          // Pinch Open (tách / mở ngón cái và ngón trỏ ra): Bung cây thông nở ra
          else if (pinchRatio > 0.85 && (detection.fingers.thumb || detection.fingers.index)) {
            pinchOpenFramesRef.current++;
            pinchCloseFramesRef.current = 0;
            if (pinchOpenFramesRef.current >= PINCH_CONFIRM_THRESHOLD) {
              if (lastModeRef.current !== TreeMode.CHAOS) {
                lastModeRef.current = TreeMode.CHAOS;
                onModeChangeRef.current(TreeMode.CHAOS);
              }
            }
          } else {
            // Between 0.35 and 0.85: Maintain current Tree mode (latched state)
            pinchCloseFramesRef.current = 0;
            pinchOpenFramesRef.current = 0;
          }

          // 4. Photo Selection Action (1 - 5 fingers extended, 0 / fist closes)
          const count = detection.count;
          if (candidateFingersRef.current === count) {
            candidateFramesRef.current++;
          } else {
            candidateFingersRef.current = count;
            candidateFramesRef.current = 1;
          }

          if (candidateFramesRef.current >= PHOTO_CONFIRM_THRESHOLD) {
            if (count >= 1 && count <= 5) {
              if (lastConfirmedPhotoRef.current !== count) {
                lastConfirmedPhotoRef.current = count;
                if (onPhotoFingerSelectRef.current) {
                  onPhotoFingerSelectRef.current(count);
                }
              }
            } else if (count === 0) {
              // Fist (0 fingers) closes photo
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
            if (onHandPositionRef.current) {
              onHandPositionRef.current(0.5, 0.5, false);
            }
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
        }
      }

      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    setupMediaPipe();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (handLandmarker) handLandmarker.close();
    };
  }, []);

  return (
    <>
      {/* Hidden camera stream and canvas for background gesture processing */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Top-right Header Controls (Language Selector & Music Player) */}
      <div className="fixed top-3 right-3 sm:top-6 sm:right-6 md:right-8 z-50 flex items-center gap-1.5 sm:gap-2 pointer-events-auto select-none">
        <LanguageToggle />
        <MusicPlayer track={currentMusic} onTrackChange={onMusicChange} />
      </div>
    </>
  );
};
