"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { useAppStore } from "@/store/useAppStore";
import { useRingGeometry } from "@/hooks/useRingGeometry";
import { MATERIALS } from "@favplace/shared";

function RingMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const heightMap = useAppStore((s) => s.heightMap);
  const material = useAppStore((s) => s.material);
  const surfaceFinish = useAppStore((s) => s.surfaceFinish);
  const ringWidth = useAppStore((s) => s.ringWidth);
  const reliefHeight = useAppStore((s) => s.reliefHeight);

  const geometry = useRingGeometry({ heightMap, reliefHeight, ringWidth });

  const mat = MATERIALS[material];
  const roughness = surfaceFinish === "matte" ? 0.6 : mat.roughness;

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial
        color={mat.color}
        metalness={mat.metalness}
        roughness={roughness}
        envMapIntensity={1.5}
        clearcoat={surfaceFinish === "polished" ? 0.3 : 0}
        clearcoatRoughness={0.1}
      />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[-5, 3, -5]} intensity={0.5} color="#fff5e0" />

      <RingMesh />

      <ContactShadows
        position={[0, -1.2, 0]}
        opacity={0.5}
        scale={5}
        blur={2}
        far={4}
      />

      <Environment preset="studio" />

      <OrbitControls
        enablePan={false}
        minDistance={1.5}
        maxDistance={5}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.5}
        autoRotate={false}
      />
    </>
  );
}

export function RingViewer({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Canvas
        shadows
        camera={{ position: [0, 1.5, 3], fov: 40 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
      >
        <Scene />
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-zinc-900/80 px-2 py-1 text-xs text-zinc-400 backdrop-blur">
        Вращайте мышью • Скролл для зума
      </div>
    </div>
  );
}
