
import React, { useRef, useEffect } from 'react';
import { Environment, OrbitControls, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Foliage } from './Foliage';
import { Ornaments } from './Ornaments';
import { Polaroids } from './Polaroids';
import { TreeStar } from './TreeStar';
import { TreeMode } from '../types';

interface ExperienceProps {
  mode: TreeMode;
  handPosition: { x: number; y: number; detected: boolean };
  uploadedPhotos: string[];
  twoHandsDetected: boolean;
  selectedPhotoIndex?: number | null;
  onClosestPhotoChange?: (photoUrl: string | null) => void;
  onPhotoClick?: (index: number) => void;
}

export const Experience: React.FC<ExperienceProps> = ({ mode, handPosition, uploadedPhotos, twoHandsDetected, selectedPhotoIndex, onClosestPhotoChange, onPhotoClick }) => {
  const controlsRef = useRef<any>(null);
  const treeGroupRef = useRef<THREE.Group>(null);

  // Auto-rotation states and activity tracking
  const autoRotateSpeed = 0.22; // ~28 seconds per full revolution (smooth, slow clockwise spin)
  const currentSpeedFactorRef = useRef(1.0);
  const prevHandPosRef = useRef({ x: 0.5, y: 0.5 });
  const lastInteractionTimeRef = useRef(0);
  const isPointerInteractingRef = useRef(false);

  // Listen to mouse/touch drag events to seamlessly pause auto-rotation during mouse interaction
  useEffect(() => {
    const handlePointerDown = () => {
      isPointerInteractingRef.current = true;
      lastInteractionTimeRef.current = performance.now();
    };
    const handlePointerUp = () => {
      isPointerInteractingRef.current = false;
      lastInteractionTimeRef.current = performance.now();
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  // Update tree clockwise auto-rotation & handle hand/camera interaction
  useFrame((_, delta) => {
    const now = performance.now();

    // 1. Detect if the user is actively moving their hand (steering)
    let isMovingHand = false;
    if (handPosition.detected) {
      const dx = handPosition.x - prevHandPosRef.current.x;
      const dy = handPosition.y - prevHandPosRef.current.y;
      const moveDist = Math.hypot(dx, dy);

      // Detect intentional hand steering movement (> 0.003 per frame) vs resting/holding gesture
      if (moveDist > 0.003) {
        lastInteractionTimeRef.current = now;
        isMovingHand = true;
      }
      prevHandPosRef.current = { x: handPosition.x, y: handPosition.y };
    }

    const timeSinceInteraction = now - lastInteractionTimeRef.current;
    const isActivelyInteracting = isPointerInteractingRef.current || isMovingHand || timeSinceInteraction < 1000;

    // 2. Smoothly transition the speed factor
    // When actively interacting: ramp down so the user has steady, stable control
    // When not interacting: ramp back up to 1.0 (resumes slow clockwise rotation)
    const targetFactor = isActivelyInteracting ? 0.0 : 1.0;
    currentSpeedFactorRef.current = THREE.MathUtils.lerp(
      currentSpeedFactorRef.current,
      targetFactor,
      delta * 2.5
    );

    // 3. Apply clockwise rotation to tree group (works in both FORMED and CHAOS modes)
    if (treeGroupRef.current) {
      // In Three.js: subtracting Y angle is clockwise when looking down from above
      treeGroupRef.current.rotation.y -= autoRotateSpeed * currentSpeedFactorRef.current * delta;
    }
  });

  return (
    <>
      <OrbitControls 
        ref={controlsRef}
        target={[0, 5.3, 0]}
        enablePan={false} 
        minPolarAngle={Math.PI / 4} 
        maxPolarAngle={Math.PI / 1.8}
        minDistance={8}
        maxDistance={30}
        enableDamping
        dampingFactor={0.05}
        enabled={true}
      />

      {/* Lighting Setup for Maximum Luxury */}
      <Environment preset="lobby" background={false} blur={0.8} />
      
      <ambientLight intensity={0.2} color="#004422" />
      <spotLight 
        position={[10, 20, 10]} 
        angle={0.2} 
        penumbra={1} 
        intensity={2} 
        color="#fff5cc" 
        castShadow 
      />
      <pointLight position={[-10, 5, -10]} intensity={1} color="#D4AF37" />

      <group position={[0, -5, 0]}>
        {/* Rotating Tree Content (Clockwise auto-rotation in both FORMED & CHAOS) */}
        <group ref={treeGroupRef}>
          <Foliage mode={mode} count={12000} />
          <Ornaments mode={mode} count={600} />
          <Polaroids 
            mode={mode} 
            uploadedPhotos={uploadedPhotos} 
            selectedPhotoIndex={selectedPhotoIndex} 
            twoHandsDetected={twoHandsDetected} 
            onClosestPhotoChange={onClosestPhotoChange} 
            onPhotoClick={onPhotoClick} 
          />
          <TreeStar mode={mode} />
        </group>
        
        {/* Floor Reflections */}
        <ContactShadows 
          opacity={0.7} 
          scale={30} 
          blur={2} 
          far={4.5} 
          color="#000000" 
        />
      </group>

      <EffectComposer enableNormalPass={false}>
        <Bloom 
          luminanceThreshold={0.8} 
          mipmapBlur 
          intensity={1.5} 
          radius={0.6}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.7} />
        <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
      </EffectComposer>
    </>
  );
};
