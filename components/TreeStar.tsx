import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeMode } from '../types';

interface TreeStarProps {
  mode: TreeMode;
}

export const TreeStar: React.FC<TreeStarProps> = ({ mode }) => {
  const starRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Create a 5-pointed star shape with top point pointing straight UP
  const starShape = useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = 0.8;
    const innerRadius = 0.32;
    const points = 5;

    for (let i = 0; i < points * 2; i++) {
      // Top point straight UP at +PI / 2 (90 degrees)
      const angle = (i * Math.PI) / points + Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    shape.closePath();

    return shape;
  }, []);

  const extrudeSettings = {
    depth: 0.15,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 3,
  };

  // Fixed formed position at the peak of the tree (foliage height = 12)
  const formedPos = useMemo(() => new THREE.Vector3(0, 12.4, 0), []);
  
  // Upright target orientation: perfectly straight and facing camera (+Z)
  const targetQuat = useMemo(() => new THREE.Quaternion(0, 0, 0, 1), []);

  // Stable chaos position in the upper sky
  const chaosPosRef = useRef(new THREE.Vector3(2, 21, -2));
  const prevModeRef = useRef<TreeMode>(mode);

  // When switching from FORMED to CHAOS, pick an exciting sky burst destination
  useEffect(() => {
    if (prevModeRef.current === TreeMode.FORMED && mode === TreeMode.CHAOS) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * 5;
      chaosPosRef.current.set(
        Math.cos(angle) * dist,
        19 + Math.random() * 5,
        Math.sin(angle) * dist
      );
    }
    prevModeRef.current = mode;
  }, [mode]);

  useFrame((state, delta) => {
    if (!starRef.current) return;

    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;
    const targetPos = isFormed ? formedPos : chaosPosRef.current;

    // Smoothly fly between sky (CHAOS) and treetop (FORMED)
    const lerpSpeed = isFormed ? 2.0 : 1.8;
    starRef.current.position.lerp(targetPos, delta * lerpSpeed);

    if (isFormed) {
      // 1. Smoothly untangle rotation back to upright orientation
      starRef.current.quaternion.slerp(targetQuat, delta * 3.0);

      // 2. Only when arrived close to the peak, lock upright and add gentle breathing hover
      const distToPeak = starRef.current.position.distanceTo(formedPos);
      if (distToPeak < 0.25) {
        starRef.current.position.y = formedPos.y + Math.sin(time * 2) * 0.05;
        starRef.current.quaternion.copy(targetQuat);
      }
    } else {
      // Free 3D spinning while in chaos / flying out
      const spinEuler = new THREE.Euler(delta * 2, delta * 3, delta * 1);
      const spinQuat = new THREE.Quaternion().setFromEuler(spinEuler);
      starRef.current.quaternion.multiply(spinQuat);
    }

    // Pulsating glow light
    if (lightRef.current) {
      const pulse = 2 + Math.sin(time * 3) * 0.5;
      lightRef.current.intensity = pulse;
    }
  });

  return (
    <group ref={starRef} position={[0, 12.4, 0]}>
      {/* Original Single Star Mesh - perfectly centered and upright */}
      <mesh position={[0, 0, -0.075]}>
        <extrudeGeometry args={[starShape, extrudeSettings]} />
        <meshStandardMaterial
          color="#D4AF37"
          emissive="#FFD700"
          emissiveIntensity={2}
          metalness={0.9}
          roughness={0.1}
          toneMapped={false}
        />
      </mesh>

      {/* Point Light for glow effect */}
      <pointLight
        ref={lightRef}
        color="#FFD700"
        intensity={2}
        distance={5}
        decay={2}
      />
    </group>
  );
};
