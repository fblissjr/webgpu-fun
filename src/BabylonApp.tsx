// src/BabylonApp.tsx
import React, { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { Engine as RLEngine, Scene, useScene, useEngine } from 'react-babylonjs';
import {
  Vector3, Color3, Color4, ArcRotateCamera, PointerEventTypes, // Added PointerEventTypes
  StandardMaterial, PBRMaterial, Texture, CubeTexture, ParticleSystem,
  GPUParticleSystem, BoxParticleEmitter, DefaultRenderingPipeline,
  MeshBuilder, Nullable,
  GlowLayer, Animation, Mesh // ActionManager, ExecuteCodeAction removed as JSX components didn't work
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

const MOCK_EMBEDDINGS_BABYLON = [
  { id: 'b_emb_0_1', position: new Vector3(-15, 5, 8), cluster: 0, name: "Quantum Entanglement", size: 1.2 },
  { id: 'b_emb_0_2', position: new Vector3(-12, 7, 10), cluster: 0, name: "String Theory", size: 1.0 },
  { id: 'b_emb_1_1', position: new Vector3(10, -5, -10), cluster: 1, name: "Neural Networks", size: 1.1 },
  { id: 'b_emb_1_2', position: new Vector3(12, -7, -8), cluster: 1, name: "Reinforcement Learning", size: 1.0 },
  { id: 'b_emb_0_3', position: new Vector3(-18, 3, 12), cluster: 0, name: "Cosmic Inflation", size: 0.9 },
  { id: 'b_emb_1_3', position: new Vector3(8, -9, -12), cluster: 1, name: "Generative Adversarial Networks", size: 1.3 },
  { id: 'b_emb_2_1', position: new Vector3(0, 10, -5), cluster: 1, name: "Large Language Models", size: 1.5 },
];

const CLUSTER_COLORS_BABYLON = [
  { base: new Color3(1.0, 0.4, 0.2), emissive: new Color3(0.9, 0.3, 0.1) },
  { base: new Color3(0.2, 0.6, 1.0), emissive: new Color3(0.1, 0.4, 0.9) },
];

interface StarCoreProps {
  position: Vector3; clusterId: number; name: string; size?: number;
  isSelected: boolean; onClick: () => void;
}
const StarCore: React.FC<StarCoreProps> = ({ position, clusterId, name, size = 1, isSelected, onClick }) => {
  const scene = useScene();
  const sphereRef = useRef<Nullable<Mesh>>(null);
  const { base: baseColor, emissive: emissiveColor } = CLUSTER_COLORS_BABYLON[clusterId % CLUSTER_COLORS_BABYLON.length];
  
  useEffect(() => {
    const mesh = sphereRef.current;
    if (mesh) {
      const scene = mesh.getScene();
      // Ensure onClick is memoized if it's passed as a prop to prevent re-adding observers.
      const pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === PointerEventTypes.POINTERPICK &&
            pointerInfo.pickInfo?.hit &&
            pointerInfo.pickInfo.pickedMesh === mesh) {
          onClick();
        }
      });
      return () => {
        scene.onPointerObservable.remove(pointerObserver);
      };
    }
  }, [sphereRef, onClick, scene]); // Added scene to dependencies for safety, though it should be stable for the mesh

  const pbrMaterial = useMemo(() => {
    if (!scene) return null;
    const mat = new PBRMaterial(`pbr-starcore-${name}-${Math.random()}`, scene);
    mat.albedoColor = baseColor;
    mat.emissiveColor = emissiveColor;
    mat.emissiveIntensity = 1.8;
    mat.metallic = 0.3;
    mat.roughness = 0.5;
    mat.reflectionTexture = scene.environmentTexture as CubeTexture ?? null;
    return mat;
  }, [scene, baseColor, emissiveColor, name]);

  useEffect(() => {
    const sphereMesh = sphereRef.current;
    if (sphereMesh && pbrMaterial) {
        const targetEmissiveIntensity = isSelected ? 2.8 : 1.8;
        const targetScaleFactor = isSelected ? 1.2 : 1;
        const finalScale = (size * 1.8) * targetScaleFactor;

        Animation.CreateAndStartAnimation(
            `emissiveAnim-${name}`, pbrMaterial, "emissiveIntensity", 
            60, 15, pbrMaterial.emissiveIntensity, targetEmissiveIntensity, Animation.ANIMATIONLOOPMODE_CONSTANT );
        Animation.CreateAndStartAnimation(
            `scaleAnim-${name}`, sphereMesh, "scaling", 
            60, 15, sphereMesh.scaling, new Vector3(finalScale, finalScale, finalScale), Animation.ANIMATIONLOOPMODE_CONSTANT );
    }
  }, [isSelected, pbrMaterial, size, name, sphereRef]);

  return (
    <>
      <sphere ref={sphereRef} name={`starcore-${name}`} diameter={size * 1.8} segments={32} position={position}
        material={pbrMaterial ?? undefined}
      >
        {/* Click/Pick handled by onPointerObservable in useEffect */}
      </sphere>
      <pointLight name={`light-starcore-${name}`} position={position}
        intensity={0.7 * (size > 1 ? size * 0.6 : 0.6) * (isSelected ? 1.6 : 1)} 
        diffuse={emissiveColor.scale(1.1)}
        specular={emissiveColor.scale(0.8)} range={25 * size} />
    </>
  );
};

interface CosmicTetherProps { from: Vector3; to: Vector3; color?: Color3; }
const CosmicTether: React.FC<CosmicTetherProps> = ({ from, to, color = new Color3(0.7, 0.7, 1) }) => {
  const scene = useScene();
  const tubeMaterial = useMemo(() => {
    if (!scene) return null;
    const mat = new StandardMaterial(`mat-tether-${from.toString()}-${to.toString()}-${Math.random()}`, scene);
    mat.diffuseColor = color;
    mat.emissiveColor = color.scale(0.7);
    mat.alpha = 0.55;
    return mat;
  }, [scene, from, to, color]);

  return (
    <tube name={`tether-${from.toString()}-${to.toString()}`} path={[from, to]} radius={0.04} tessellation={16} cap={Mesh.CAP_ALL} material={tubeMaterial ?? undefined}>
       {/* Material is now a prop, materialFromInstance removed, MeshBuilder.CAP_ALL changed to Mesh.CAP_ALL */}
    </tube>
  );
};

const NeuralConstellationsScene: React.FC = () => {
  const scene = useScene();
  const engine = useEngine();
  const particleSystemRef = useRef<Nullable<GPUParticleSystem>>(null);
  const [selectedStarId, setSelectedStarId] = useState<Nullable<string>>(null);
  const cameraRef = useRef<Nullable<ArcRotateCamera>>(null);

  useEffect(() => {
    if (scene && engine) {
      scene.clearColor = new Color4(0.005, 0.005, 0.015, 1);

      const skybox = MeshBuilder.CreateBox("skyBox", { size: 1500.0 }, scene);
      const skyboxMaterial = new PBRMaterial("skyBoxMat", scene);
      skyboxMaterial.backFaceCulling = false;
      skyboxMaterial.disableLighting = true; 
      skyboxMaterial.emissiveColor = new Color3(0.03, 0.03, 0.07); 
      skybox.material = skyboxMaterial;
      
      const pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, scene.cameras);
      pipeline.bloomEnabled = true; pipeline.bloomThreshold = 0.18; pipeline.bloomWeight = 0.65;
      pipeline.bloomKernel = 56; pipeline.bloomScale = 0.45;
      
      const glowLayer = new GlowLayer("glow", scene, { mainTextureSamples: 2 });
      glowLayer.intensity = 0.55;

      if (GPUParticleSystem.IsSupported) {
        const stardustSystem = new GPUParticleSystem("stardust", { capacity: 12000 }, scene); 
        stardustSystem.particleTexture = new Texture("https://assets.babylonjs.com/particles/textures/flare.png", scene);
        stardustSystem.emitter = Vector3.Zero();
        const emitterSize = 280;
        stardustSystem.particleEmitterType = new BoxParticleEmitter(); // No arguments
        (stardustSystem.particleEmitterType as BoxParticleEmitter).minEmitBox = new Vector3(-emitterSize/2, -emitterSize/2, -emitterSize/2);
        (stardustSystem.particleEmitterType as BoxParticleEmitter).maxEmitBox = new Vector3(emitterSize/2, emitterSize/2, emitterSize/2);
        stardustSystem.minAngularSpeed = -0.35; stardustSystem.maxAngularSpeed = 0.35;
        stardustSystem.minSize = 0.025; stardustSystem.maxSize = 0.11;
        stardustSystem.minLifeTime = 3.5; stardustSystem.maxLifeTime = 7.5;
        stardustSystem.emitRate = 550;
        stardustSystem.blendMode = ParticleSystem.BLENDMODE_ADD;
        stardustSystem.color1 = new Color4(0.65, 0.65, 0.95, 0.075);
        stardustSystem.color2 = new Color4(0.35, 0.35, 0.85, 0.035);
        stardustSystem.colorDead = new Color4(0.06, 0.06, 0.12, 0);
        stardustSystem.minEmitPower = 0.25; stardustSystem.maxEmitPower = 0.75;
        stardustSystem.updateSpeed = 0.012;
        stardustSystem.gravity = Vector3.Zero();
        stardustSystem.addVelocityGradient(0, 0.025); // Removed third argument
        stardustSystem.addVelocityGradient(1.0, -0.025); // Removed third argument
        stardustSystem.start();
        particleSystemRef.current = stardustSystem;
      }
      return () => { 
        pipeline?.dispose();
        glowLayer?.dispose();
        particleSystemRef.current?.dispose();
        skybox?.dispose();
        // scene cleanup for materials & textures is often handled by react-babylonjs or by disposing the scene itself
      }
    }
  }, [scene, engine]); // engine dependency might be removed if engine is always available via useEngine()

  const tethers = useMemo(() => {
    const connections: JSX.Element[] = [];
    MOCK_EMBEDDINGS_BABYLON.forEach((emb1, i) => {
      for (let j = i + 1; j < MOCK_EMBEDDINGS_BABYLON.length; j++) {
        const emb2 = MOCK_EMBEDDINGS_BABYLON[j];
        if (emb1.cluster === emb2.cluster && Vector3.Distance(emb1.position, emb2.position) < 15) {
          connections.push( <CosmicTether key={`tether-${emb1.id}-${emb2.id}`} from={emb1.position} to={emb2.position}
              color={CLUSTER_COLORS_BABYLON[emb1.cluster % CLUSTER_COLORS_BABYLON.length].base.clone().scale(0.6)} />
          );
        }
      }
    });
    return connections;
  }, []);

  useEffect(() => {
    const camera = cameraRef.current;
    if (camera && scene) { // Ensure scene is available for animation context
        const starData = MOCK_EMBEDDINGS_BABYLON.find(s => s.id === selectedStarId);
        const targetPosition = starData ? starData.position : Vector3.Zero(); 
        
        Animation.CreateAndStartAnimation(
            "camTargetAnim", camera, "target", 
            60, 20, camera.target, targetPosition, Animation.ANIMATIONLOOPMODE_CONSTANT, undefined, undefined, scene );
    }
  }, [selectedStarId, scene, cameraRef]); // Added cameraRef to dependencies

  const handleStarClick = (id: string) => {
    setSelectedStarId(prevId => prevId === id ? null : id); 
  };

  return (
    <>
      <arcRotateCamera ref={cameraRef} name="camera1" target={Vector3.Zero()} alpha={Math.PI / 2.2} beta={Math.PI / 2.8}
        radius={45} minZ={0.1} maxZ={2000} lowerRadiusLimit={8} upperRadiusLimit={150} wheelPrecision={40}
        useAutoRotationBehavior={true}
        />
        {/* autoRotationBehavior prop and its options will be set in useEffect once cameraRef is valid, if direct props aren't available in react-babylonjs for these specific sub-properties */}
      <hemisphericLight name="hemiLight" intensity={0.18} direction={Vector3.Up()} groundColor={new Color3(0.1, 0.1, 0.4)}/>
      {MOCK_EMBEDDINGS_BABYLON.map(emb => <StarCore key={emb.id} position={emb.position} name={emb.name} size={emb.size} clusterId={emb.cluster} isSelected={selectedStarId === emb.id} onClick={() => handleStarClick(emb.id)} />)}
      {tethers}
    </>
  );
};

const EngineTypeDisplay: React.FC = () => {
  const engine = useEngine();
  const [engineType, setEngineType] = useState("Detecting...");
  useEffect(() => {
    if (engine) {
      // Check constructor name or a specific capability
      if (engine.constructor.name === "WebGPUEngine") {
        setEngineType("WebGPU");
      } else {
        setEngineType("WebGL");
      }
    }
  }, [engine]);
  return <>{engineType}</>;
}

const BabylonApp: React.FC = () => {
  // Removed manual engine creation and related states (engine, error, engineType from here)
  // react-babylonjs <Engine> component will manage the engine lifecycle.
  const engineOptions = useMemo(() => ({
    preferWebGPU: true,
    antialias: true,
    adaptToDeviceRatio: true,
    stencil: true,
    preserveDrawingBuffer: true, // Kept from original WebGL fallback
  }), []);

  // Note: The error state for WebGPU fallback needs a different handling now,
  // potentially by trying to render with WebGL if WebGPU fails,
  // or by using a global error boundary. For now, this is simplified.

  return (
    <div style={{ width: '100%', height: '100%', background:'#000005', position: 'relative' }}>
      {/*
        The <Engine> component from react-babylonjs will create the canvas.
        No need for babylonCanvasRef or manual placeholder canvas if RLEngine handles it.
        If a specific canvas ID is needed, it can be passed to <Engine canvasId='...'>.
      */}
      <RLEngine engineOptions={engineOptions} canvasId="babylon-canvas-rl">
        <Scene>
          <Suspense fallback={ <BabylonHtmlFallback center>
                  <div style={{color:'white', textAlign:'center', fontSize: '1.2em', background:'rgba(0,0,0,0.5)', padding:'20px', borderRadius:'8px'}}>
                      Loading Neural Constellations...
                  </div>
              </BabylonHtmlFallback> }>
            <NeuralConstellationsScene />
          </Suspense>
        </Scene>
      </RLEngine>
      <div style={{ position: 'absolute', bottom: '10px', right: '10px', color: 'rgba(220, 220, 255, 0.75)',
        fontSize: '12px', fontFamily: 'Arial, sans-serif', background: 'rgba(0,0,10,0.7)',
        padding: '5px 10px', borderRadius: '5px', zIndex: 10000 }}>
        <b>Neural Constellations (Babylon.js)</b> <br />
        Features: PBR, GPU Particles, Post-Processing, Dynamic Interactions <br />
        Renderer: <EngineTypeDisplay />
      </div>
    </div>
  );
};
export default BabylonApp;

const BabylonHtmlFallback: React.FC<{center?: boolean, children: React.ReactNode}> = ({center, children}) => {
    const scene = useScene(); 
    const divRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (divRef.current && center && scene?.getEngine().getRenderingCanvas()) {
            const canvas = scene.getEngine().getRenderingCanvas();
            if(canvas){ 
                divRef.current.style.position = 'absolute'; 
                divRef.current.style.top = '50%';
                divRef.current.style.left = '50%';
                divRef.current.style.transform = 'translate(-50%, -50%)';
                divRef.current.style.zIndex = '100'; 
            }
        }
    }, [center, scene]);
    return <div ref={divRef}>{children}</div>; 
}