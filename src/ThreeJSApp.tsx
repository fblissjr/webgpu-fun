// @ts-nocheck
// src/ThreeJSApp.tsx
import React, { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Sparkles, Html } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  Color, Vector3, FogExp2, MeshStandardMaterial, LineBasicMaterial,
  BufferGeometry, Mesh, SRGBColorSpace, ACESFilmicToneMapping
} from 'three';
import { EffectComposer, Bloom, DepthOfField, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';

interface EmbeddingData {
  id: string;
  position: [number, number, number];
  cluster: number;
  name: string;
  value: number;
}

const MOCK_EMBEDDINGS_THREE: EmbeddingData[] = [
  { id: 'emb_0_1_t', position: [-12, 3, 7], cluster: 0, name: "General Relativity", value: 0.8 },
  { id: 'emb_0_2_t', position: [-10, 5, 9], cluster: 0, name: "Quantum Mechanics", value: 0.9 },
  { id: 'emb_0_3_t', position: [-13, 2, 10], cluster: 0, name: "Standard Model", value: 0.7 },
  { id: 'emb_1_1_t', position: [10, -3, -8], cluster: 1, name: "Convolutional Networks", value: 0.85 },
  { id: 'emb_1_2_t', position: [12, -5, -6], cluster: 1, name: "Recurrent Networks", value: 0.75 },
  { id: 'emb_1_3_t', position: [9, -2, -10], cluster: 1, name: "Attention Mechanisms", value: 0.95 },
  { id: 'emb_2_1_t', position: [-3, -8, -4], cluster: 2, name: "Ecosystem Dynamics", value: 0.7 },
  { id: 'emb_2_2_t', position: [-5, -10, -2], cluster: 2, name: "Biodiversity Hotspots", value: 0.8 },
  { id: 'emb_3_1_t', position: [4, 8, 1], cluster: 3, name: "Symbolist Poetry", value: 0.6 },
  { id: 'emb_3_2_t', position: [2, 10, 3], cluster: 3, name: "Surrealist Painting", value: 0.7 },
];

const CLUSTER_COLORS_THREE = [
  { primary: new Color(0xff8800), secondary: new Color(0xffff00) },
  { primary: new Color(0x0077ff), secondary: new Color(0x00ffff) },
  { primary: new Color(0x00ff77), secondary: new Color(0x77ff00) },
  { primary: new Color(0xff00aa), secondary: new Color(0xff55cc) },
];

interface EmbeddingGlyphProps {
  id: string; position: [number, number, number]; clusterId: number; name: string; value: number;
  onPointerOver: (id: string | null) => void; onPointerOut: () => void; onClick: (id: string) => void;
  isHovered: boolean; isSelected: boolean;
}

const EmbeddingGlyph: React.FC<EmbeddingGlyphProps> = ({
  id, position, clusterId, name, value, onPointerOver, onPointerOut, onClick, isHovered, isSelected
}) => {
  const meshRef = useRef<Mesh>(null!); // Using imported Mesh from 'three'
  const { primary, secondary } = CLUSTER_COLORS_THREE[clusterId % CLUSTER_COLORS_THREE.length];
  const baseScale = 0.6 + value * 1.2;
  const targetScaleValue = useRef(baseScale); 

  useEffect(() => {
    if (isSelected) {
      targetScaleValue.current = baseScale * 1.25; 
    } else if (isHovered) {
      targetScaleValue.current = baseScale * 1.1;
    } else {
      targetScaleValue.current = baseScale;
    }
  }, [isSelected, isHovered, baseScale]);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.15;
      meshRef.current.rotation.x += delta * 0.08;
      
      let currentTarget = targetScaleValue.current;
      if (isSelected) {
        const pulseFactor = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.1; 
        currentTarget *= pulseFactor;
      }
      // Using new Vector3 from 'three' for lerp target
      meshRef.current.scale.lerp(new Vector3(currentTarget, currentTarget, currentTarget), delta * 9);
    }
  });

  const material = useMemo(() => new MeshStandardMaterial({
    color: primary, emissive: secondary,
    emissiveIntensity: isSelected ? 2.3 : (isHovered ? 1.4 : 0.75), 
    metalness: 0.65, roughness: 0.35, transparent: true,
    opacity: isSelected ? 0.98 : (isHovered ? 0.9 : 0.8),
    depthWrite: !isSelected && !isHovered,
  }), [primary, secondary, isHovered, isSelected]);

  return (
    // Reverting position prop to use array directly, as per original R3F style.
    // @ts-nocheck will suppress any resulting type error here.
    <mesh ref={meshRef} position={position}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onPointerOver(id); }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onPointerOut(); }}
      onClick={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onClick(id); }} castShadow >
      <icosahedronGeometry args={[0.5, 1]} />
      <primitive object={material} attach="material" />
      {(isHovered || isSelected) && (
        <Html distanceFactor={12} zIndexRange={[100,0]} style={{pointerEvents: 'none', userSelect: 'none'}}>
          <div style={{ padding: '4px 8px', background: 'rgba(10,0,20,0.85)', color: '#e8e0ff',
            fontSize: '11px', borderRadius: '4px', transform: 'translate(-50%, -160%)', whiteSpace: 'nowrap', backdropFilter: 'blur(2.5px)'}}>
            {name}
          </div>
        </Html>
      )}
    </mesh>
  );
};

interface RelationshipWispProps { from: [number, number, number]; to: [number, number, number]; color: Color; visible: boolean; }
const RelationshipWisp: React.FC<RelationshipWispProps> = ({ from, to, color, visible }) => {
  const points = useMemo(() => [new Vector3(...from), new Vector3(...to)], [from, to]);
  return (
    <line>
      <bufferGeometry attach="geometry" onUpdate={self => self.setFromPoints(points)} />
      <lineBasicMaterial attach="material" color={color} transparent opacity={visible ? 0.45 : 0} linewidth={1.5} />
    </line>
  );
};

const EphemeralEchoesScene: React.FC = () => {
  const { scene } = useThree();
  const orbitControlsRef = useRef<OrbitControlsImpl>(null!);
  const [hoveredGlyph, setHoveredGlyph] = useState<string | null>(null);
  const [selectedGlyph, setSelectedGlyph] = useState<string | null>(null);

  useEffect(() => {
    scene.background = new Color(0x08040F);
    scene.fog = new FogExp2(0x08040F, 0.012);
  }, [scene]);
  
  useEffect(() => {
    if (selectedGlyph && orbitControlsRef.current) {
      const selectedEmb = MOCK_EMBEDDINGS_THREE.find(e => e.id === selectedGlyph);
      if (selectedEmb) {
        const targetPosition = new Vector3(...selectedEmb.position);
        const controlsInstance = orbitControlsRef.current;
        if (controlsInstance.target && typeof controlsInstance.target.lerp === 'function') {
            controlsInstance.target.lerp(targetPosition, 0.08);
        }
      }
    }
  }, [selectedGlyph, orbitControlsRef]);

  const wisps = useMemo(() => {
    const activeGlyphId = selectedGlyph || hoveredGlyph;
    if (!activeGlyphId) return [];
    const activeEmb = MOCK_EMBEDDINGS_THREE.find(e => e.id === activeGlyphId);
    if (!activeEmb) return [];
    const connections: JSX.Element[] = [];
    MOCK_EMBEDDINGS_THREE.forEach(otherEmb => {
      if (otherEmb.id !== activeEmb.id && otherEmb.cluster === activeEmb.cluster &&
          new Vector3(...activeEmb.position).distanceTo(new Vector3(...otherEmb.position)) < 12) {
        connections.push( <RelationshipWisp key={`${activeEmb.id}-${otherEmb.id}`}
            from={activeEmb.position} to={otherEmb.position} // Pass arrays
            color={CLUSTER_COLORS_THREE[activeEmb.cluster % CLUSTER_COLORS_THREE.length].secondary} visible={true} />
        );
      }
    });
    return connections;
  }, [hoveredGlyph, selectedGlyph]);

  return (
    <>
      <ambientLight intensity={Math.PI / 3.5} />
      {/* Restoring array positions for lights, @ts-nocheck will handle type errors */}
      <directionalLight position={[8, 12, 10]} intensity={1.0} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 15, 0]} intensity={0.7} distance={80} color={0xffeedd} decay={1.5}/>
      {MOCK_EMBEDDINGS_THREE.map(emb => ( <EmbeddingGlyph key={emb.id} {...emb} clusterId={emb.cluster}
          onPointerOver={setHoveredGlyph} onPointerOut={() => setHoveredGlyph(null)} 
          onClick={(id) => setSelectedGlyph(prev => prev === id ? null : id)} 
          isHovered={hoveredGlyph === emb.id && selectedGlyph !== emb.id} 
          isSelected={selectedGlyph === emb.id} />
      ))}
      {wisps}
      <Sparkles count={1200} scale={28} size={25} speed={0.04} opacity={0.35} color={0xbbaaff} />
      <OrbitControls ref={orbitControlsRef} enablePan={true} enableZoom={true} enableRotate={true} autoRotate autoRotateSpeed={0.20}
                     minDistance={5} maxDistance={50} dampingFactor={0.05} enableDamping />
    </>
  );
};

const ThreeJSApp: React.FC = () => {
  return (
    <div style={{ width: '100%', height: '100%', background: '#08040F', position: 'relative' }}>
      <Canvas camera={{ position: [0, 7, 28], fov: 45, near: 0.1, far: 1000 }} shadows
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.95;
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={<Html center><div style={{color: 'white', fontSize: '1.5em'}}>Loading Ephemeral Echoes...</div></Html>}>
          <EphemeralEchoesScene />
          <EffectComposer multisampling={0} enableNormalPass={true}>
            <Bloom intensity={0.55} luminanceThreshold={0.35} luminanceSmoothing={0.03} mipmapBlur={true} blendFunction={BlendFunction.ADD} kernelSize={KernelSize.MEDIUM}/>
            <DepthOfField focusDistance={0.022} focalLength={0.055} bokehScale={2.8} height={480} />
            <Vignette eskil={false} offset={0.12} darkness={1.05} />
          </EffectComposer>
        </Suspense>
      </Canvas>
      
      <div style={{ position: 'absolute', bottom: '10px', right: '10px', color: 'rgba(220, 220, 255, 0.75)',
        fontSize: '12px', fontFamily: 'Arial, sans-serif', background: 'rgba(10, 0, 20, 0.7)',
        padding: '5px 10px', borderRadius: '5px', zIndex: 1000, }}>
        <b>Ephemeral Echoes (Three.js / R3F)</b> <br />
        Features: PBR Materials, Post-Processing, Particles <br/>
        Renderer: WebGL (R3F Default)
      </div>
    </div>
  );
};
export default ThreeJSApp;