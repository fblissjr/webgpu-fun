// src/PixiApp.tsx
// PixiJS v8+ `Assets.init` is the primary way to influence renderer choice.
// @pixi/react `Stage` component correctly manages PIXI.Application lifecycle.
// Pan/zoom and interaction logic seem robust from previous iterations.
// Minor filter memoization.

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Stage, Container, Graphics, Text as PixiText, useTick, useApp } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { BlurFilter } from '@pixi/filter-blur'; // Explicit import

// Pixi Assets initialization (global, runs once)
let pixiAssetsInitializedPromise: Promise<void> | null = null;
const initializePixiAssets = async () => {
    if (!pixiAssetsInitializedPromise) {
        pixiAssetsInitializedPromise = (async () => {
            try {
                await PIXI.Assets.init({
                    preferences: {
                        preferWebGPU: true, // Request WebGPU
                        // fallbackSources: ['webgl2', 'webgl'], // Define fallback order if needed
                    },
                });
                console.log("PixiApp: PIXI.Assets initialized with WebGPU preference.");
            } catch (e) {
                console.warn("PixiApp: PIXI.Assets.init with WebGPU preference failed:", e);
                // Fallback to default init (usually WebGL2 then WebGL1)
                await PIXI.Assets.init({}); 
                console.log("PixiApp: PIXI.Assets initialized with default preferences.");
            }
        })();
    }
    return pixiAssetsInitializedPromise;
};

const MOCK_EMBEDDINGS_PIXI = [
  { id: 'p_emb_0_1', position: { x: 200, y: 300 }, cluster: 0, name: "Library of Alexandria", size: 25, rune: '📜' },
  { id: 'p_emb_0_2', position: { x: 350, y: 250 }, cluster: 0, name: "Oracle of Delphi", size: 30, rune: '🧿' },
  { id: 'p_emb_1_1', position: { x: 700, y: 500 }, cluster: 1, name: "Philosopher's Stone", size: 35, rune: '💎' },
  { id: 'p_emb_1_2', position: { x: 850, y: 450 }, cluster: 1, name: "Aqua Vitae", size: 28, rune: '💧' },
  { id: 'p_emb_0_3', position: { x: 280, y: 450 }, cluster: 0, name: "Antikythera Mechanism", size: 22, rune: '⚙️' },
  { id: 'p_emb_1_3', position: { x: 780, y: 600 }, cluster: 1, name: "Caduceus Staff", size: 32, rune: '⚕️' },
];

const CLUSTER_COLORS_PIXI = [
  { primary: 0xDAA520, secondary: 0xFFD700, glow: 0xFFE4B5, thread: 0xFFA500 },
  { primary: 0x483D8B, secondary: 0x9370DB, glow: 0xE6E6FA, thread: 0x7B68EE },
];

const SCROLL_WIDTH = 2500;
const SCROLL_HEIGHT = 1500;

interface RuneGlyphProps {
  x: number; y: number; name: string; size: number; clusterId: number; runeChar: string;
  isSelected: boolean; isHovered: boolean; onClick: () => void;
  onPointerOver: () => void; onPointerOut: () => void;
}

const RuneGlyph: React.FC<RuneGlyphProps> = ({
  x, y, name, size, clusterId, runeChar, isSelected, isHovered, onClick, onPointerOver, onPointerOut
}) => {
  const [rotation, setRotation] = useState(Math.random() * Math.PI * 2);
  const { primary, secondary, glow } = CLUSTER_COLORS_PIXI[clusterId % CLUSTER_COLORS_PIXI.length];
  const timeRef = useRef(0);
  const currentScaleRef = useRef(1); // For lerping scale

  useTick(delta => {
    timeRef.current += delta;
    setRotation(r => r + delta * 0.004 * (isSelected ? 1.8 : 1));
    
    // Smoothly interpolate scale
    const targetScale = isSelected ? 1.28 : (isHovered ? 1.18 : 1);
    currentScaleRef.current += (targetScale - currentScaleRef.current) * 0.2 * delta * 10; // Adjust lerp factor
  });
  
  const currentAlpha = isSelected ? 1 : (isHovered ? 0.95 : 0.88);
  const animatedScale = currentScaleRef.current;

  const blurFilterGlow = useMemo(() => new BlurFilter(isSelected || isHovered ? 5 : 2.5), [isSelected, isHovered]);
  const blurFilterHighlight = useMemo(() => new BlurFilter(isSelected ? 4 : 2), [isSelected]);


  const drawRuneBackground = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.beginFill(glow, 0.22 * currentAlpha);
    g.drawCircle(0, 0, size * 1.38); // Scale applied to parent container
    g.endFill();
  }, [size, glow, currentAlpha]);

  const drawRuneHighlight = useCallback((g: PIXI.Graphics) => {
    g.clear();
    const highlightAlpha = currentAlpha * (isSelected ? 0.85 : (isHovered ? 0.55 : 0));
    if (highlightAlpha > 0) {
        const pulse = isSelected ? (Math.sin(timeRef.current * 0.08) * 0.2 + 0.8) : 1;
        g.lineStyle(isSelected ? 4.5 : 3.5, PIXI.utils.mixColors(secondary, 0xFFFFFF, 0.65), highlightAlpha * pulse);
        g.drawCircle(0, 0, size * (isSelected ? 1.18 : 1.08));
    }
  }, [size, secondary, currentAlpha, isSelected, isHovered]);


  const drawRune = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.beginFill(primary, currentAlpha * 0.92); 
    g.lineStyle(isSelected ? 3.5 : 2.5, secondary, currentAlpha * 0.85);
    g.drawCircle(0, 0, size);
    g.endFill();
  }, [size, primary, secondary, currentAlpha, isSelected]);

  const textStyle = useMemo(() => new PIXI.TextStyle({
    fontSize: size * 1.15, fill: secondary, stroke: PIXI.utils.mixColors(primary, 0x000000, 0.4),
    strokeThickness: 2.5, align: 'center',
    dropShadow: true, dropShadowColor: glow, dropShadowBlur: 7, dropShadowAlpha: 0.65,
    fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
  }), [size, primary, secondary, glow]);

  const nameTextStyle = useMemo(() => new PIXI.TextStyle({
    fontSize: 13, fill: 0xf5f5f5, stroke: 0x050505, strokeThickness: 3.5,
    wordWrap: true, wordWrapWidth: 170, align: 'center',
    dropShadow: true, dropShadowColor: 0x000000, dropShadowBlur: 4, dropShadowAlpha: 0.85,
  }), []);

  return (
    <Container x={x} y={y} interactive={true} buttonMode={true} scale={animatedScale}
      pointerover={onPointerOver} pointerout={onPointerOut} pointertap={onClick} >
      <Graphics draw={drawRuneBackground} filters={[blurFilterGlow]} alpha={currentAlpha * 0.9}/>
      <Graphics draw={drawRuneHighlight} filters={[blurFilterHighlight]} />
      <Graphics draw={drawRune} alpha={currentAlpha}/>
      <PixiText text={runeChar} anchor={0.5} alpha={currentAlpha} style={textStyle} rotation={rotation} />
      {(isHovered || isSelected) && (
        <PixiText text={name} anchor={[0.5, 1]} y={-size * 0.8 - 14 / animatedScale } style={nameTextStyle} />
      )}
    </Container>
  );
};

interface WeavingThreadProps { from: { x: number, y: number }; to: { x: number, y: number }; color: number; }
const WeavingThread: React.FC<WeavingThreadProps> = ({ from, to, color }) => {
  const [progress, setProgress] = useState(0);
  useTick(delta => { if (progress < 1) setProgress(p => Math.min(1, p + delta * 0.025)); }); 

  const drawThread = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.lineStyle(2.8, color, 0.55); 
    const currentToX = from.x + (to.x - from.x) * progress;
    const currentToY = from.y + (to.y - from.y) * progress;
    g.moveTo(from.x, from.y);
    g.quadraticCurveTo(
        from.x + (to.x - from.x) * progress * 0.5, 
        from.y + (to.y - from.y) * progress * 0.5 + Math.sin(progress * Math.PI) * 25,
        currentToX, currentToY
    );
    if (progress > 0.04 && progress < 0.96) {
        g.beginFill(PIXI.utils.mixColors(color, 0xFFFFFF, 0.75), 0.65);
        g.drawCircle(currentToX, currentToY, 3.8);
        g.endFill();
    }
  }, [from, to, color, progress]);

  const blurFilter = useMemo(() => new BlurFilter(2.5), []); 

  return <Graphics draw={drawThread} filters={[blurFilter]}/>;
};

const ChronoScrollsSceneContent: React.FC = () => {
  const app = useApp();
  const [hoveredRune, setHoveredRune] = useState<string | null>(null);
  const [selectedRune, setSelectedRune] = useState<string | null>(null);
  const [{ x: viewX, y: viewY }, setViewportPosition] = useState({ x: SCROLL_WIDTH / 2, y: SCROLL_HEIGHT / 2 });
  const [zoom, setZoom] = useState(0.75); 
  const containerRef = useRef<PIXI.Container>(null);

  const handleRuneClick = useCallback((id: string) => {
    setSelectedRune(prev => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    const stage = app.stage;
    let dragging = false; let prevScreenX: number, prevScreenY: number;

    const onDragStart = (event: PIXI.FederatedPointerEvent) => { 
        dragging = true; 
        prevScreenX = event.global.x; 
        prevScreenY = event.global.y;
        if(stage) stage.cursor = 'grabbing';
    };
    const onDragEnd = () => { dragging = false; if(stage) stage.cursor = 'grab';};
    const onDragMove = (event: PIXI.FederatedPointerEvent) => {
      if (dragging && containerRef.current) { 
        const dx = event.global.x - prevScreenX;
        const dy = event.global.y - prevScreenY;
        setViewportPosition(pos => ({ x: pos.x - dx / zoom, y: pos.y - dy / zoom }));
        prevScreenX = event.global.x;
        prevScreenY = event.global.y;
      }
    };
    const view = app.view as unknown as HTMLCanvasElement; 
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (containerRef.current && view) {
          const scrollAmount = event.deltaY * -0.001; 
          const newZoom = Math.max(0.15, Math.min(3.5, zoom * (1 + scrollAmount))); 
          
          const rect = view.getBoundingClientRect();
          const mouseScreenX = event.clientX - rect.left;
          const mouseScreenY = event.clientY - rect.top;

          const worldPointX = viewX + (mouseScreenX - app.screen.width / 2) / zoom;
          const worldPointY = viewY + (mouseScreenY - app.screen.height / 2) / zoom;
          
          const newViewX = worldPointX - (mouseScreenX - app.screen.width / 2) / newZoom;
          const newViewY = worldPointY - (mouseScreenY - app.screen.height / 2) / newZoom;
          
          setZoom(newZoom);
          setViewportPosition({x: newViewX, y: newViewY});
      }
    };

    if (view && view.style) { 
        view.addEventListener('wheel', onWheel, { passive: false });
        stage.interactive = true; stage.hitArea = app.screen; 
        stage.on('pointerdown', onDragStart); stage.on('pointerup', onDragEnd);
        stage.on('pointerupoutside', onDragEnd); stage.on('pointermove', onDragMove);
        if (stage.cursor !== 'grabbing') stage.cursor = 'grab'; 
    }
    return () => {
      if (view && view.style) view.removeEventListener('wheel', onWheel);
      if(stage){ 
        stage.off('pointerdown', onDragStart); stage.off('pointerup', onDragEnd);
        stage.off('pointerupoutside', onDragEnd); stage.off('pointermove', onDragMove);
      }
    };
  }, [app, zoom, viewX, viewY]); 


  const threads = useMemo(() => {
    const activeRuneId = selectedRune || hoveredRune;
    if (!activeRuneId) return [];
    const activeEmb = MOCK_EMBEDDINGS_PIXI.find(e => e.id === activeRuneId);
    if (!activeEmb) return [];
    const connections: JSX.Element[] = [];
    MOCK_EMBEDDINGS_PIXI.forEach(otherEmb => {
      if (otherEmb.id !== activeEmb.id && otherEmb.cluster === activeEmb.cluster &&
          Math.hypot(activeEmb.position.x - otherEmb.position.x, activeEmb.position.y - otherEmb.position.y) < 400) {
        connections.push( <WeavingThread key={`${activeEmb.id}-${otherEmb.id}`} from={activeEmb.position} to={otherEmb.position}
            color={CLUSTER_COLORS_PIXI[activeEmb.cluster % CLUSTER_COLORS_PIXI.length].thread} />
        );
      }
    });
    return connections;
  }, [hoveredRune, selectedRune]);

  const drawScrollBackground = useCallback((g: PIXI.Graphics) => {
    g.clear(); g.beginFill(0x1a120b, 0.92); g.drawRect(0, 0, SCROLL_WIDTH, SCROLL_HEIGHT); g.endFill();
    g.lineStyle(1.8, 0x33261b, 0.65);
    for (let i = 0; i < SCROLL_HEIGHT; i += 60) { g.moveTo(0, i + Math.random()*15-7.5); g.bezierCurveTo(SCROLL_WIDTH*0.3, i+Math.random()*25-12.5, SCROLL_WIDTH*0.7, i+Math.random()*25-12.5, SCROLL_WIDTH, i+Math.random()*15-7.5); }
    for (let i = 0; i < SCROLL_WIDTH; i += 80) { g.moveTo(i + Math.random()*15-7.5, 0); g.bezierCurveTo(i+Math.random()*25-12.5, SCROLL_HEIGHT*0.3, i+Math.random()*25-12.5, SCROLL_HEIGHT*0.7, i+Math.random()*15-7.5, SCROLL_HEIGHT); }
  }, []);

  const containerX = app.screen.width / 2 - viewX * zoom;
  const containerY = app.screen.height / 2 - viewY * zoom;

  return (
    <Container ref={containerRef} x={containerX} y={containerY} scale={zoom}>
      <Graphics draw={drawScrollBackground} />
      {threads}
      {MOCK_EMBEDDINGS_PIXI.map(emb => ( <RuneGlyph key={emb.id} {...emb}
          isSelected={selectedRune === emb.id} 
          isHovered={hoveredRune === emb.id && selectedRune !== emb.id}
          onClick={() => handleRuneClick(emb.id)} 
          onPointerOver={() => setHoveredRune(emb.id)} 
          onPointerOut={() => setHoveredRune(null)} />
      ))}
    </Container>
  );
};

const PixiApp: React.FC = () => {
  const appRef = useRef<PIXI.Application | null>(null);
  const [isPixiAssetsReady, setIsPixiAssetsReady] = useState(false);
  const [rendererType, setRendererType] = useState<string>("Initializing Assets...");
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    initializePixiAssets().then(() => {
        if(isMountedRef.current) {
          setIsPixiAssetsReady(true);
        }
    });
    return () => {
        isMountedRef.current = false;
        // Consider if PIXI.Assets.reset() is needed here or if it's too broad.
        // For this demo, if the app is unmounted, resetting assets might be okay.
    }
  }, []);
  
  const stageOptions = useMemo(() => ({
    backgroundAlpha: 1, backgroundColor: 0x0a0503,
    width: window.innerWidth, height: window.innerHeight,
    antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1,
  }), []);
  
  const handleAppMount = useCallback((app: PIXI.Application) => {
    appRef.current = app; 
    const currentRenderer = app.renderer;
    if (currentRenderer.type === PIXI.RENDERER_TYPE.WEBGPU) {
        setRendererType("WebGPU");
    } else if (currentRenderer.type === PIXI.RENDERER_TYPE.WEBGL) {
        setRendererType("WebGL"); // Could also check for WebGL2 vs WebGL1 if needed
    } else {
        setRendererType("Canvas");
    }
    console.log(`PixiApp: Mounted with ${PIXI.RENDERER_TYPE[currentRenderer.type]} renderer.`);

    const handleResize = () => {
        if (appRef.current) { 
            appRef.current.renderer.resize(window.innerWidth, window.innerHeight);
        }
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
        window.removeEventListener('resize', handleResize);
        // The <Stage> component from @pixi/react handles PIXI.Application destruction on unmount.
        // Nullifying the ref is good practice.
        if (appRef.current) {
             console.log("PixiApp: handleAppMount cleanup, app will be destroyed by Stage.");
             appRef.current = null;
        }
    };
  }, []);


  if (!isPixiAssetsReady) {
    return (
        <div style={{width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', background: '#0a0503', fontSize: '1.2em'}}>
            Initializing PixiJS Assets & Renderer...
        </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', cursor: 'grab', background: '#0a0503', overflow: 'hidden' }}>
        <Stage options={stageOptions} onMount={handleAppMount}>
          <ChronoScrollsSceneContent />
        </Stage>
      <div style={{ position: 'absolute', bottom: '10px', right: '10px', color: 'rgba(220, 200, 180, 0.88)',
        fontSize: '12px', fontFamily: 'Courier New, monospace', background: 'rgba(30,20,10,0.8)',
        padding: '5px 10px', borderRadius: '3px', zIndex: 10000, }}>
        <b>Chrono-Scrolls (PixiJS)</b> <br/>
        Features: 2D Sprites & Graphics, Custom Pan/Zoom, Filters <br />
        Renderer: {rendererType}
      </div>
    </div>
  );
};
export default PixiApp;