
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';
import { TreeMode, ActiveTrack } from '../types';
import { MaskType, MASK_OPTIONS, FaceMaskRenderer, MASK_METRICS } from './FaceMasks';
import { useLanguage } from '../context/LanguageContext';
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

    // Tip is extended when significantly further from wrist and MCP than PIP joint is (6% cushion prevents jitter)
    return distTipWrist > distPipWrist * 1.06 && distTipMcp > distPipMcp * 1.06;
  };

  const isIndex = checkFinger(8, 6, 5);
  const isMiddle = checkFinger(12, 10, 9);
  const isRing = checkFinger(16, 14, 13);
  const isPinky = checkFinger(20, 18, 17);

  // Thumb detection: tip 4, ip 3, mcp 2, index base 5, pinky base 17
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

  // Robust, fail-safe thumb detection:
  // A thumb is CLOSED only when curled into the palm (tip closer to pinky base than IP is, or curled tight under index)
  // Otherwise, if open/extended naturally, it is OPEN.
  const isClosedThumb = (distTipPinky < distIpPinky * 0.98) || (distTipWrist < distMcpWrist * 1.15 && distTipIndex < palmWidth * 0.55);
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

/**
 * Accurately determines whether a hand is physically the Right Hand or Left Hand.
 * Combines:
 * 1) MediaPipe neural handedness: in @mediapipe/tasks-vision, categoryName directly reports the subject's physical hand ('Right' or 'Left')
 * 2) 3D anatomical topological determinant: det([Middle - Wrist, Pinky - Index, Thumb - Wrist])
 */
export function determineHandedness(
  landmarks: any[],
  mpCategory?: string
): 'Right' | 'Left' {
  // 1. MediaPipe Hand Landmarker neural handedness
  let mpPhysical: 'Right' | 'Left' | null = null;
  if (mpCategory === 'Right') {
    mpPhysical = 'Right';
  } else if (mpCategory === 'Left') {
    mpPhysical = 'Left';
  }

  // 2. 3D Topological Triple Product: det([Middle - Wrist, Pinky - Index, Thumb - Wrist])
  // Rotation-invariant in 3D:
  // Physical Right Hand has det > 0
  // Physical Left Hand has det < 0
  let geomHandedness: 'Right' | 'Left' | null = null;
  if (landmarks && landmarks.length >= 21) {
    const wrist = landmarks[0];
    const middle = landmarks[9];
    const index = landmarks[5];
    const pinky = landmarks[17];
    const thumb = landmarks[2];

    const u = [middle.x - wrist.x, middle.y - wrist.y, (middle.z || 0) - (wrist.z || 0)];
    const v = [pinky.x - index.x, pinky.y - index.y, (pinky.z || 0) - (index.z || 0)];
    const t = [thumb.x - wrist.x, thumb.y - wrist.y, (thumb.z || 0) - (wrist.z || 0)];

    const cx = u[1] * v[2] - u[2] * v[1];
    const cy = u[2] * v[0] - u[0] * v[2];
    const cz = u[0] * v[1] - u[1] * v[0];

    const det = cx * t[0] + cy * t[1] + cz * t[2];

    // Physical Right Hand has det > 0, Physical Left Hand has det < 0
    geomHandedness = det > 0 ? 'Right' : 'Left';
  }

  // If MediaPipe neural prediction is available, prefer it; fall back to 3D geometry
  if (mpPhysical) {
    return mpPhysical;
  }
  return geomHandedness || 'Right';
}

export const GestureController: React.FC<GestureControllerProps> = ({
  onModeChange,
  currentMode,
  onHandPosition,
  onTwoHandsDetected,
  onPhotoFingerSelect,
  selectedPhotoIndex,
  currentMask = 'none',
  onMaskChange,
  currentMusic = null,
  onMusicChange,
}) => {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraBoxRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isCameraMinimized, setIsCameraMinimized] = useState(false);
  const [gestureStatus, setGestureStatus] = useState<string>("Initializing...");
  const [treeStatus, setTreeStatus] = useState<string>("Nắm: Thu");
  const [photoFingers, setPhotoFingers] = useState<number | null>(null);
  const [handPos, setHandPos] = useState<{ x: number; y: number } | null>(null);

  // Dynamic prop callback refs to avoid recreating animation loops
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

  // When photo overlay is closed (selectedPhotoIndex becomes null), reset confirmed photo
  // so the same photo can be reopened immediately with gesture
  useEffect(() => {
    if (selectedPhotoIndex === null || selectedPhotoIndex === undefined) {
      lastConfirmedPhotoRef.current = null;
      candidateFingersRef.current = null;
      candidateFramesRef.current = 0;
    }
  }, [selectedPhotoIndex]);
  
  // Face Mask states (AR filter) - Default is strictly 'none' (Original face)
  const [selectedMask, setSelectedMask] = useState<MaskType>(currentMask || 'none');

  useEffect(() => {
    if (currentMask !== undefined) {
      setSelectedMask(currentMask);
    }
  }, [currentMask]);
  const [isMaskPopupOpen, setIsMaskPopupOpen] = useState(false);
  const [isFaceModelLoaded, setIsFaceModelLoaded] = useState(false);
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

  // Sync mask ref and reset detection when turning mask off
  useEffect(() => {
    selectedMaskRef.current = selectedMask;
    if (selectedMask === 'none') {
      smoothedFaceRef.current.detected = false;
      setFaceTransform((prev) => ({ ...prev, detected: false }));
    }
  }, [selectedMask]);

  // Close mask popup on click outside
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

  // Tree Debounce logic refs
  const openFrames = useRef(0);
  const closedFrames = useRef(0);
  const CONFIDENCE_THRESHOLD = 4; // Number of consecutive frames to confirm tree gesture

  // Photo Finger Debounce refs (Consecutive stability counter prevents rapid photo jumping)
  const candidateFingersRef = useRef<number | null>(null);
  const candidateFramesRef = useRef(0);
  const lastConfirmedPhotoRef = useRef<number | null>(null);
  const noPhotoHandFramesRef = useRef(0);
  const PHOTO_CONFIRM_THRESHOLD = 5; // Must hold gesture steady for 5 consecutive frames (~160ms) to trigger/switch

  // Single-hand handedness persistence to prevent role flipping during fast hand movement
  const singleHandHistoryRef = useRef<'Right' | 'Left' | null>(null);
  const singleHandStreakRef = useRef(0);

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let faceLandmarker: FaceLandmarker | null = null;
    let animationFrameId: number;

    const setupMediaPipe = async () => {
      try {
        // Use jsDelivr CDN
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        // 1. Hand Landmarker for gestures (track up to 2 hands simultaneously)
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `/models/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });

        // 2. Face Landmarker for automatic AR filter
        try {
          faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: `/models/face_landmarker.task`,
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numFaces: 1
          });
          setIsFaceModelLoaded(true);
        } catch (faceErr) {
          console.warn("FaceLandmarker GPU init failed, trying CPU:", faceErr);
          try {
            faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: `/models/face_landmarker.task`,
                delegate: "CPU"
              },
              runningMode: "VIDEO",
              numFaces: 1
            });
            setIsFaceModelLoaded(true);
          } catch (cpuErr) {
            console.error("FaceLandmarker init failed:", cpuErr);
          }
        }

        startWebcam();
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
        console.warn("Gesture control is unavailable. The app will still work without it.");
        setGestureStatus("Gesture control unavailable");
      }
    };

    const startWebcam = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: "user" }
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener("loadeddata", predictWebcam);
            setIsLoaded(true);
            setGestureStatus("Waiting for hand...");
          }
        } catch (err) {
          console.error("Error accessing webcam:", err);
          setGestureStatus("Permission Denied");
        }
      }
    };

    // Draw a single hand skeleton with role-based colors
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
        [5, 9], [9, 13], [13, 17]
      ];

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = lineColor;
      connections.forEach(([start, end]) => {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        ctx.beginPath();
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
        ctx.stroke();
      });

      landmarks.forEach((landmark) => {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = pointColor;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });
    };

    // Draw all detected hands with distinct colors for Tree Hand and Photo Hand
    const drawAllHands = (
      hands: Array<{ landmarks: any[]; isTree: boolean; isPhoto: boolean }>
    ) => {
      if (!canvasRef.current || !videoRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      hands.forEach((h) => {
        // Tree Hand: Gold lines + Green points
        // Photo Hand: Sky Blue lines + Pink/Amber points
        const lineColor = h.isPhoto ? '#38BDF8' : '#D4AF37';
        const pointColor = h.isPhoto ? '#F43F5E' : '#10B981';
        drawSingleHandSkeleton(h.landmarks, ctx, canvas, lineColor, pointColor);
      });
    };

    const predictWebcam = () => {
      if (!handLandmarker || !videoRef.current) return;

      const startTimeMs = performance.now();
      if (videoRef.current.videoWidth > 0) {
        const result = handLandmarker.detectForVideo(videoRef.current, startTimeMs);

        if (result.landmarks && result.landmarks.length > 0) {
          const numHands = result.landmarks.length;
          if (onTwoHandsDetectedRef.current) {
            onTwoHandsDetectedRef.current(numHands >= 2);
          }

          // Parse each detected hand
          const hands = result.landmarks.map((lm, idx) => {
            const palmX = (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5;
            const palmY = (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5;
            // Mirrored screen coordinate (0 = left, 1 = right)
            const screenX = 1 - palmX;
            const detection = countExtendedFingers(lm);
            const mpCategory = result.handednesses?.[idx]?.[0]?.categoryName;
            const handedness = determineHandedness(lm, mpCategory);

            return {
              landmarks: lm,
              palmX,
              palmY,
              screenX,
              fingerCount: detection.count,
              rawIndex: idx,
              handedness,
              isRightHand: handedness === 'Right',
              isLeftHand: handedness === 'Left',
            };
          });

          let treeHand: typeof hands[0] | null = null;
          let photoHand: typeof hands[0] | null = null;

          if (hands.length >= 2) {
            singleHandHistoryRef.current = null;
            singleHandStreakRef.current = 0;

            // Two hands detected:
            const rightCandidate = hands.find((h) => h.isRightHand);
            const leftCandidate = hands.find((h) => h.isLeftHand);

            if (rightCandidate && leftCandidate) {
              treeHand = rightCandidate;
              photoHand = leftCandidate;
            } else {
              // Spatial fallback if both hands received identical label
              const sorted = [...hands].sort((a, b) => b.screenX - a.screenX);
              treeHand = sorted[0];
              photoHand = sorted[1];
            }
          } else {
            // Single hand detected:
            const single = hands[0];
            const rawHandedness = single.handedness;

            // Hysteresis smoothing: hold previous identity until 4 consecutive opposing frames
            if (!singleHandHistoryRef.current) {
              singleHandHistoryRef.current = rawHandedness;
              singleHandStreakRef.current = 2;
            } else if (singleHandHistoryRef.current === rawHandedness) {
              singleHandStreakRef.current = Math.min(singleHandStreakRef.current + 1, 10);
            } else {
              singleHandStreakRef.current--;
              if (singleHandStreakRef.current <= 0) {
                singleHandHistoryRef.current = rawHandedness;
                singleHandStreakRef.current = 2;
              }
            }

            const confirmedHandedness = singleHandHistoryRef.current;
            if (confirmedHandedness === 'Right') {
              // Physical Right Hand -> Tree Control & 3D Pan/Tilt only! NEVER opens photos, regardless of screenX!
              treeHand = single;
              photoHand = null;
            } else {
              // Physical Left Hand -> Photo Control only!
              photoHand = single;
              treeHand = null;
            }
          }

          // Draw skeletons with role colors
          const handsToDraw = hands.map((h) => ({
            landmarks: h.landmarks,
            isTree: treeHand ? h.landmarks === treeHand.landmarks : false,
            isPhoto: photoHand ? h.landmarks === photoHand.landmarks : false,
          }));
          drawAllHands(handsToDraw);

          // 1. Process Tree Hand (Formed vs Chaos & Camera rotation)
          if (treeHand) {
            setHandPos({ x: treeHand.palmX, y: treeHand.palmY });
            if (onHandPositionRef.current) {
              onHandPositionRef.current(treeHand.palmX, treeHand.palmY, true);
            }

            if (treeHand.fingerCount >= 4) {
              openFrames.current++;
              closedFrames.current = 0;
              setTreeStatus("Xòe (Bung)");
              if (openFrames.current > CONFIDENCE_THRESHOLD) {
                if (lastModeRef.current !== TreeMode.CHAOS) {
                  lastModeRef.current = TreeMode.CHAOS;
                  onModeChangeRef.current(TreeMode.CHAOS);
                }
              }
            } else if (treeHand.fingerCount <= 1) {
              closedFrames.current++;
              openFrames.current = 0;
              setTreeStatus("Nắm (Thu)");
              if (closedFrames.current > CONFIDENCE_THRESHOLD) {
                if (lastModeRef.current !== TreeMode.FORMED) {
                  lastModeRef.current = TreeMode.FORMED;
                  onModeChangeRef.current(TreeMode.FORMED);
                }
              }
            } else {
              openFrames.current = 0;
              closedFrames.current = 0;
              setTreeStatus("Xoay góc");
            }
          } else {
            if (onHandPositionRef.current && !photoHand) {
              onHandPositionRef.current(0.5, 0.5, false);
              setHandPos(null);
            }
          }

          // 2. Process Photo Hand (1..5 fingers opens photo 1..5, 0 fingers / fist closes)
          if (photoHand) {
            noPhotoHandFramesRef.current = 0;
            const detected = photoHand.fingerCount;
            setPhotoFingers(detected);

            // Consecutive Stability Counter: prevents jumping during finger transitions & hand tremors
            if (candidateFingersRef.current === detected) {
              candidateFramesRef.current++;
            } else {
              candidateFingersRef.current = detected;
              candidateFramesRef.current = 1;
            }

            // Only act when the user has held the exact same finger count steadily for 5 consecutive frames (~160ms)
            if (candidateFramesRef.current >= PHOTO_CONFIRM_THRESHOLD) {
              if (detected >= 1 && detected <= 5) {
                if (lastConfirmedPhotoRef.current !== detected) {
                  lastConfirmedPhotoRef.current = detected;
                  if (onPhotoFingerSelectRef.current) {
                    onPhotoFingerSelectRef.current(detected);
                  }
                }
              } else if (detected === 0) {
                // Clenched fist -> Close photo
                if (lastConfirmedPhotoRef.current !== null) {
                  lastConfirmedPhotoRef.current = null;
                  if (onPhotoFingerSelectRef.current) {
                    onPhotoFingerSelectRef.current(null);
                  }
                }
              }
            }
          } else {
            noPhotoHandFramesRef.current++;
            // Hand lowered / out of view for ~250ms -> close photo
            if (noPhotoHandFramesRef.current > 8) {
              setPhotoFingers(null);
              candidateFingersRef.current = null;
              candidateFramesRef.current = 0;
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
          setGestureStatus("Không phát hiện tay");
          setTreeStatus("Chờ tay");
          setPhotoFingers(null);
          setHandPos(null);
          candidateFingersRef.current = null;
          candidateFramesRef.current = 0;
          openFrames.current = 0;
          closedFrames.current = 0;
          singleHandHistoryRef.current = null;
          singleHandStreakRef.current = 0;
          noPhotoHandFramesRef.current++;

          if (onHandPositionRef.current) {
            onHandPositionRef.current(0.5, 0.5, false);
          }
          if (onTwoHandsDetectedRef.current) {
            onTwoHandsDetectedRef.current(false);
          }
          if (lastConfirmedPhotoRef.current !== null && noPhotoHandFramesRef.current > 6) {
            lastConfirmedPhotoRef.current = null;
            if (onPhotoFingerSelectRef.current) {
              onPhotoFingerSelectRef.current(null);
            }
          }

          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
          }
        }

        // 2. Real-time AR Face Filter Tracking
        if (faceLandmarker && selectedMaskRef.current !== 'none') {
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

              // Roll / tilt angle (inverted for mirrored video)
              const rawAngle = Math.atan2(dy, dx);
              const targetAngle = -rawAngle * (180 / Math.PI);

              // Face Center
              const rawCx = (leftCheek.x + rightCheek.x) / 2;
              const rawCy = (forehead.y + chin.y) / 2;

              const metrics = MASK_METRICS[selectedMaskRef.current] || MASK_METRICS.santa;
              const offsetCy = rawCy + (chin.y - forehead.y) * metrics.yOffsetPct;

              // Display coordinates on mirrored video
              const targetX = (1 - rawCx) * 100;
              const targetY = offsetCy * 100;
              const targetW = faceWidth * metrics.widthMultiplier * 100;
              const targetH = faceHeight * metrics.heightMultiplier * 100;

              // Exponential smoothing for natural AR filter adherence
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
              // If face is temporarily occluded, hold last position for 15 frames before hiding
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
    <div className="fixed top-3 right-3 sm:top-6 sm:right-6 md:right-8 z-50 flex items-start gap-1.5 sm:gap-2.5 pointer-events-none select-none">
      {/* Control Buttons (Language Switcher & Music Player) on the LEFT of the Camera */}
      <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
        <LanguageToggle />
        <MusicPlayer track={currentMusic} onTrackChange={onMusicChange} />
      </div>

      {/* Camera Section */}
      <div className="pointer-events-auto flex flex-col items-end relative">
        {/* Minimized Camera Pill (Windows Taskbar style) */}
        {isCameraMinimized && (
          <button
            onClick={() => setIsCameraMinimized(false)}
            className="group flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-[#D4AF37]/70 bg-black/90 hover:bg-[#D4AF37]/20 backdrop-blur-md shadow-[0_0_15px_rgba(212,175,55,0.25)] text-[#F5E6BF] hover:text-white text-[11px] sm:text-xs font-sans transition-all cursor-pointer"
            title={t('maximizeCamera')}
          >
            <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{t('cameraTitle')}</span>
            <div className="w-4 h-4 rounded flex items-center justify-center bg-white/10 group-hover:bg-[#D4AF37]/30 transition-colors ml-0.5">
              <svg className="w-2.5 h-2.5 text-[#D4AF37]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
              </svg>
            </div>
          </button>
        )}

        {/* Camera Preview Frame */}
      <div 
        ref={cameraBoxRef}
        className={`relative w-24 h-[72px] sm:w-28 sm:h-[84px] md:w-[130px] md:h-[98px] border-2 border-[#D4AF37] rounded-lg overflow-hidden shadow-[0_0_20px_rgba(212,175,55,0.3)] bg-black transition-all ${isCameraMinimized ? 'hidden' : 'block'}`}
      >
        {/* Decorative Lines */}
        <div className="absolute inset-0 border border-[#F5E6BF]/20 m-1 rounded-sm z-10 pointer-events-none"></div>

        {/* Windows-style Minimize "-" Button & Face Mask Icon */}
        <div className="absolute top-1 right-1 z-30 pointer-events-auto flex flex-col gap-1">
          {/* Minimize button */}
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

          {/* Face Mask Button (below minimize button) */}
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
          className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
        
        {/* Canvas for hand skeleton overlay */}
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

        {/* Scanning indicator when mask selected but face not yet detected */}
        {selectedMask !== 'none' && !faceTransform.detected && (
          <div className="absolute inset-0 z-25 pointer-events-none flex flex-col items-center justify-center bg-black/30 backdrop-blur-[1px]">
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-[#D4AF37] animate-spin mb-1 opacity-70"></div>
            <span className="text-[9px] text-[#F5E6BF] font-sans font-medium px-2 py-0.5 rounded bg-black/70 border border-[#D4AF37]/40 shadow">
              Đang quét mặt...
            </span>
          </div>
        )}
        
        {/* Hand Position Indicator */}
        {handPos && (
          <div 
            className="absolute w-2 h-2 bg-[#D4AF37] rounded-full border border-white z-20 pointer-events-none"
            style={{
              left: `${(1 - handPos.x) * 100}%`,
              top: `${handPos.y * 100}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        )}


      </div>

      {/* Face Mask Selection Popup */}
      {isMaskPopupOpen && !isCameraMinimized && (
        <div 
          ref={popupRef}
          className="absolute top-full right-0 mt-2 w-[calc(100vw-24px)] max-w-[320px] sm:w-72 p-3 bg-black/95 backdrop-blur-md border-2 border-[#D4AF37] rounded-xl shadow-[0_0_25px_rgba(212,175,55,0.4)] z-50 pointer-events-auto animate-scale-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#D4AF37]/30">
            <div className="flex items-center gap-2">
              <span className="text-base">🎭</span>
              <span className="font-sans text-xs font-bold text-[#F5E6BF] tracking-wide">
                {t('faceMaskPopupTitle')}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Real-time Tracking Status Pill */}
              {selectedMask !== 'none' && (
                <span className={`flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 rounded-full border ${
                  faceTransform.detected
                    ? 'text-emerald-300 bg-emerald-950/70 border-emerald-500/50'
                    : 'text-amber-300 bg-amber-950/70 border-amber-500/50'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${faceTransform.detected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                  {faceTransform.detected ? t('faceMaskTracking') : t('faceMaskScanning')}
                </span>
              )}

              <button
                onClick={() => setIsMaskPopupOpen(false)}
                className="w-5 h-5 rounded flex items-center justify-center text-[#D4AF37] hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs"
                title={t('faceMaskClose')}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Mask Options Grid */}
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

          {/* AR Filter Footer Note */}
          <div className="mt-2.5 pt-2 border-t border-[#D4AF37]/20 text-[10px] text-[#D4AF37]/80 font-sans flex items-center gap-1.5">
            <span>✨</span>
            <span>{t('faceMaskFooter')}</span>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
