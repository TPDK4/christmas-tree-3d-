
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { TreeMode } from '../types';

/**
 * ==================================================================================
 *  INSTRUCTIONS FOR LOCAL PHOTOS
 * ==================================================================================
 * 1. Create a folder named "photos" inside your "public" directory.
 *    (e.g., public/photos/)
 * 
 * 2. Place your JPG images in there.
 * 
 * 3. Rename them sequentially:
 *    1.jpg, 2.jpg, 3.jpg ... up to 13.jpg
 * 
 *    If a file is missing (e.g., you only have 5 photos), the frame will 
 *    display a placeholder instead of crashing the app.
 * ==================================================================================
 */

const PHOTO_COUNT = 22; // How many polaroid frames to generate

interface PolaroidsProps {
  mode: TreeMode;
  uploadedPhotos: string[];
  selectedPhotoIndex?: number | null;
  twoHandsDetected?: boolean;
  onClosestPhotoChange?: (photoUrl: string | null) => void;
  onPhotoClick?: (index: number) => void;
}

interface PhotoData {
  id: number;
  url: string;
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  speed: number;
}

const PolaroidItem: React.FC<{ data: PhotoData; mode: TreeMode; index: number; isSelected?: boolean; onPhotoClick?: (index: number) => void }> = ({ data, mode, index, isSelected = false, onPhotoClick }) => {
  const groupRef = useRef<THREE.Group>(null);
  const branchGroupRef = useRef<THREE.Group>(null);
  const framePivotRef = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [error, setError] = useState(false);

  // Safe texture loading with dual-strategy fallback (Direct TextureLoader + Fetch Blob)
  useEffect(() => {
    let isCancelled = false;
    let objectUrlToRevoke: string | null = null;

    const loadTexture = async () => {
      // 1. Normalize URL: if from r2.dev or r2.cloudflarestorage.com (which lacks CORS on mobile Safari), route through same-origin /api/photo proxy
      let targetUrl = data.url;
      if (targetUrl && (targetUrl.includes('.r2.dev') || targetUrl.includes('.r2.cloudflarestorage.com'))) {
        try {
          const parsed = new URL(targetUrl);
          const pathKey = parsed.pathname.replace(/^\/+/, '');
          targetUrl = `/api/photo?key=${encodeURIComponent(pathKey)}`;
        } catch (e) {}
      }

      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');

      loader.load(
        targetUrl,
        (loadedTex) => {
          if (isCancelled) return;
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          loadedTex.needsUpdate = true;
          setTexture(loadedTex);
          setError(false);
        },
        undefined, // onProgress
        async (err) => {
          console.warn(`TextureLoader failed for ${targetUrl}, trying fetch blob fallback:`, err);
          // 2. Fallback: Fetch raw binary blob and create a local blob: URL (bypasses all WebGL image CORS/iOS WebKit bugs)
          try {
            const resp = await fetch(targetUrl);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            objectUrlToRevoke = blobUrl;

            loader.load(
              blobUrl,
              (blobTex) => {
                if (isCancelled) return;
                blobTex.colorSpace = THREE.SRGBColorSpace;
                blobTex.needsUpdate = true;
                setTexture(blobTex);
                setError(false);
              },
              undefined,
              (blobErr) => {
                if (isCancelled) return;
                console.error(`Blob texture loading failed:`, blobErr);
                setError(true);
              }
            );
          } catch (fetchErr) {
            if (isCancelled) return;
            console.error(`Fetch blob fallback failed:`, fetchErr);
            setError(true);
          }
        }
      );
    };

    loadTexture();

    return () => {
      isCancelled = true;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [data.url]);
  
  // Random sway offset
  const swayOffset = useMemo(() => Math.random() * 100, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;
    
    // 1. Position Interpolation
    const targetPos = isFormed ? data.targetPos : data.chaosPos;
    const step = delta * data.speed;
    
    // Smooth lerp to target position
    groupRef.current.position.lerp(targetPos, step);

    // Dynamic Scale: 1.4x base size so photos are clearly visible without zooming, 1.75x when selected
    const targetScale = isSelected ? 1.75 : 1.4;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);

    // 2. Rotation & Sway Logic
    if (isFormed) {
        // Look at center but face outward
        const dummy = new THREE.Object3D();
        dummy.position.copy(groupRef.current.position);
        dummy.lookAt(0, groupRef.current.position.y, 0); 
        dummy.rotateY(Math.PI); // Flip to face out
        
        // Base rotation alignment
        groupRef.current.quaternion.slerp(dummy.quaternion, step);
        
        // Physical Swaying (Wind)
        // Z-axis rotation for side-to-side swing
        const swayAngle = Math.sin(time * 2.0 + swayOffset) * 0.08;
        // X-axis rotation for slight front-back tilt
        const tiltAngle = Math.cos(time * 1.5 + swayOffset) * 0.05;
        
        groupRef.current.rotateZ(swayAngle * delta * 5); // Apply over time or directly? 
        // For stable sway, we add to the base rotation calculated above.
        // But since we slerp quaternion, let's just add manual rotation after slerp?
        // Easier: Set rotation directly based on dummy + sway.
        
        // Calculate the "perfect" rotation
        const currentRot = new THREE.Euler().setFromQuaternion(groupRef.current.quaternion);
        groupRef.current.rotation.z = currentRot.z + swayAngle * 0.05; 
        groupRef.current.rotation.x = currentRot.x + tiltAngle * 0.05;
        
    } else {
        // Chaos mode - face toward camera with gentle floating
        // Camera position relative to scene group: [0, 9, 20]
        const cameraPos = new THREE.Vector3(0, 9, 20);
        const dummy = new THREE.Object3D();
        dummy.position.copy(groupRef.current.position);
        
        // Make photos face the camera
        dummy.lookAt(cameraPos);
        
        // Smoothly rotate to face camera
        groupRef.current.quaternion.slerp(dummy.quaternion, delta * 3);
        
        // Add gentle floating wobble
        const wobbleX = Math.sin(time * 1.5 + swayOffset) * 0.03;
        const wobbleZ = Math.cos(time * 1.2 + swayOffset) * 0.03;
        
        const currentRot = new THREE.Euler().setFromQuaternion(groupRef.current.quaternion);
        groupRef.current.rotation.x = currentRot.x + wobbleX;
        groupRef.current.rotation.z = currentRot.z + wobbleZ;
    }

    // 3. Physical Tilt & Diagonal Slant ("Nghiêng chéo") for the Polaroid frame around its top clip
    if (framePivotRef.current) {
      if (isFormed) {
        // Natural diagonal slant: alternate left / right tilt by ~8° to 12° for realistic hand-hung look
        const baseSlantZ = (index % 2 === 0 ? 1 : -1) * (0.15 + (index % 3) * 0.03); 
        // Pitch tilt: bottom swings forward by ~16° (-0.28 rad) to follow tree cone slope and clear baubles
        const baseTiltX = -0.28;
        // Subtle yaw variation
        const baseTurnY = (index % 2 === 0 ? 0.05 : -0.05);

        // Gentle wind sway
        const swayZ = Math.sin(time * 2.2 + swayOffset) * 0.03;
        const swayX = Math.cos(time * 1.7 + swayOffset) * 0.02;

        framePivotRef.current.rotation.x = THREE.MathUtils.lerp(framePivotRef.current.rotation.x, baseTiltX + swayX, delta * 4);
        framePivotRef.current.rotation.z = THREE.MathUtils.lerp(framePivotRef.current.rotation.z, baseSlantZ + swayZ, delta * 4);
        framePivotRef.current.rotation.y = THREE.MathUtils.lerp(framePivotRef.current.rotation.y, baseTurnY, delta * 4);
      } else {
        // Chaos mode - smoothly straighten up to view photo cleanly
        framePivotRef.current.rotation.x = THREE.MathUtils.lerp(framePivotRef.current.rotation.x, 0, delta * 3);
        framePivotRef.current.rotation.z = THREE.MathUtils.lerp(framePivotRef.current.rotation.z, (index % 2 === 0 ? 0.04 : -0.04), delta * 3);
        framePivotRef.current.rotation.y = THREE.MathUtils.lerp(framePivotRef.current.rotation.y, 0, delta * 3);
      }
    }

    // 4. Smooth transition for Branch & Hook assembly
    if (branchGroupRef.current) {
      const targetBranchScale = isFormed ? 1 : 0;
      branchGroupRef.current.scale.lerp(
        new THREE.Vector3(targetBranchScale, targetBranchScale, targetBranchScale),
        delta * 5
      );
      branchGroupRef.current.visible = branchGroupRef.current.scale.x > 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      
      {/* Hanging Branch, Needles, S-Hook & Slanted Gold Wire Assembly */}
      <group ref={branchGroupRef}>
        {/* The Slanted Golden Wire - angled back towards the tree foliage */}
        <mesh position={[0, 1.085, -0.435]} rotation={[-0.955, 0, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 1.09, 8]} />
          <meshStandardMaterial 
            color="#FCD866" 
            metalness={0.85} 
            roughness={0.2} 
            emissive="#C4920E" 
            emissiveIntensity={0.3} 
          />
        </mesh>

        {/* Christmas Ornament S-Hook */}
        <group>
          {/* Top curve looping over the pine branch */}
          <mesh position={[0, 1.47, -0.89]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.055, 0.011, 8, 20, Math.PI * 1.4]} />
            <meshStandardMaterial color="#FFDF6D" metalness={0.95} roughness={0.15} />
          </mesh>
          {/* Middle straight hook shank */}
          <mesh position={[0, 1.43, -0.88]}>
            <cylinderGeometry args={[0.009, 0.009, 0.06, 8]} />
            <meshStandardMaterial color="#FFDF6D" metalness={0.95} roughness={0.15} />
          </mesh>
          {/* Bottom curve holding the wire loop */}
          <mesh position={[0, 1.40, -0.88]} rotation={[0, -Math.PI / 2, 0]}>
            <torusGeometry args={[0.042, 0.009, 8, 16, Math.PI * 1.3]} />
            <meshStandardMaterial color="#FFDF6D" metalness={0.95} roughness={0.15} />
          </mesh>
        </group>

        {/* Realistic Pine Branch & Foliage Needles inside the tree */}
        <group>
          {/* Horizontal pine twig branch */}
          <mesh position={[0, 1.48, -0.90]} rotation={[0.05, 0.12, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.048, 0.95, 8]} />
            <meshStandardMaterial color="#2E1808" roughness={0.9} />
          </mesh>
          {/* Branch extension arm running into the central tree trunk */}
          <mesh position={[0, 1.48, -1.35]} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.042, 0.052, 0.95, 8]} />
            <meshStandardMaterial color="#221206" roughness={0.9} />
          </mesh>
          {/* Pine needle clusters nestled around the branch */}
          <mesh position={[-0.20, 1.46, -0.88]} rotation={[0.3, 0.3, -0.6]}>
            <coneGeometry args={[0.11, 0.38, 5]} />
            <meshStandardMaterial color="#0A3319" roughness={0.8} />
          </mesh>
          <mesh position={[0.20, 1.49, -0.92]} rotation={[-0.2, -0.3, 0.6]}>
            <coneGeometry args={[0.10, 0.35, 5]} />
            <meshStandardMaterial color="#0E4623" roughness={0.8} />
          </mesh>
          <mesh position={[0.04, 1.51, -0.87]} rotation={[0.4, 0.1, 0.1]}>
            <coneGeometry args={[0.12, 0.32, 5]} />
            <meshStandardMaterial color="#12562B" roughness={0.8} />
          </mesh>
          <mesh position={[-0.06, 1.44, -0.89]} rotation={[-0.3, 0.2, -0.2]}>
            <coneGeometry args={[0.09, 0.30, 5]} />
            <meshStandardMaterial color="#092B15" roughness={0.8} />
          </mesh>
          {/* Decorative gold berry on the twig */}
          <mesh position={[-0.14, 1.45, -0.87]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      </group>

      {/* Frame Group with Top-Clip Pivot - tilts diagonally & leans forward naturally */}
      <group 
        ref={framePivotRef} 
        position={[0, 0.75, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onPhotoClick?.(index + 1);
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        
        {/* White Paper Backing */}
        <mesh position={[0, -0.75, 0]}>
          <boxGeometry args={[1.2, 1.5, 0.02]} />
          <meshStandardMaterial 
            color={isSelected ? "#FFF3C4" : "#fdfdfd"} 
            roughness={0.7} 
            emissive={isSelected ? "#D4AF37" : "#000000"}
            emissiveIntensity={isSelected ? 0.35 : 0}
          />
        </mesh>

        {/* The Photo Area */}
        <mesh position={[0, -0.60, 0.025]}>
          <planeGeometry args={[1.0, 1.0]} />
          {texture && !error ? (
            <meshBasicMaterial map={texture} />
          ) : (
            // Fallback Material (Red for error, Grey for loading)
            <meshStandardMaterial color={error ? "#550000" : "#cccccc"} />
          )}
        </mesh>
        
        {/* Gold Clip / Clamp at Top */}
        <mesh position={[0, -0.03, 0.02]} rotation={[0,0,0]}>
           <boxGeometry args={[0.15, 0.06, 0.04]} />
           <meshStandardMaterial color="#E6C657" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Gold Eyelet Ring on top of Clip */}
        <mesh position={[0, 0.02, 0.01]}>
          <torusGeometry args={[0.04, 0.009, 8, 16]} />
          <meshStandardMaterial color="#FFD700" metalness={0.95} roughness={0.2} emissive="#D4AF37" emissiveIntensity={0.2} />
        </mesh>

        {/* Text Label */}
        <Text
          position={[0, -1.30, 0.03]}
          fontSize={0.12}
          color="#333"
          anchorX="center"
          anchorY="middle"
        >
          {error ? "Image not found" : "Merry Christmas"}
        </Text>
      </group>
    </group>
  );
};

export const Polaroids: React.FC<PolaroidsProps> = ({ mode, uploadedPhotos, selectedPhotoIndex, twoHandsDetected, onClosestPhotoChange, onPhotoClick }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [closestPhotoIndex, setClosestPhotoIndex] = React.useState<number>(0);

  const photoData = useMemo(() => {
    // Don't render any photos if none are uploaded
    if (uploadedPhotos.length === 0) {
      return [];
    }

    const data: PhotoData[] = [];
    const treeHeight = 11.5;
    const count = uploadedPhotos.length;

    for (let i = 0; i < count; i++) {
      // 1. Target Position: Elevated to the upper-middle canopy (45% to 83% of tree height)
      // Directly aligned with camera eye-level so users don't need to zoom or tilt down
      const fraction = count <= 1 ? 0.5 : i / (count - 1);
      const yNorm = 0.45 + fraction * 0.38; // Between 0.45 and 0.83 (y = 5.18 to 9.55)
      const y = yNorm * treeHeight;
      
      // Radius on cone: tapers towards the top (y=12)
      // Positioned cleanly outside the baubles & foliage surface with +0.85 offset so no spheres pierce the photo
      const coneR = 4.8 * (1 - y / 12.0) + 0.85;
      
      // Golden Angle Spiral for even distribution around the tree
      const theta = i * 2.39996 + 0.8;
      
      const targetPos = new THREE.Vector3(
        coneR * Math.cos(theta),
        y,
        coneR * Math.sin(theta)
      );

      // 2. Chaos Position - Bursting out in all 3D directions across the scene (360 degrees)
      // Evenly scattered radially, spanning all heights and depths around the tree so they don't cluster together
      const angle = (i / count) * Math.PI * 2 + 0.4;
      const dist = 9.5 + ((i * 3) % 4) * 1.6; // Radial spread from 9.5 to 14.3 units
      const heightSpread = 3.5 + ((i * 2) % 5) * 1.9; // Vertical spread from 3.5 to 11.1 units
      
      const chaosPos = new THREE.Vector3(
        dist * Math.cos(angle),
        heightSpread,
        dist * Math.sin(angle)
      );

      data.push({
        id: i,
        url: uploadedPhotos[i],
        chaosPos,
        targetPos,
        speed: 0.8 + Math.random() * 1.5
      });
    }
    return data;
  }, [uploadedPhotos]);

  return (
    <group ref={groupRef}>
      {photoData.map((data, i) => (
        <PolaroidItem 
          key={i} 
          index={i} 
          data={data} 
          mode={mode}
          isSelected={selectedPhotoIndex !== null && selectedPhotoIndex !== undefined && (selectedPhotoIndex - 1 === i)}
          onPhotoClick={onPhotoClick}
        />
      ))}
    </group>
  );
};
