// src/DeckGLApp.tsx
// No major API changes for Deck.gl 9.1.12.
// Current layer and effect usage is consistent with docs.
// Renderer detection heuristic is pragmatic.
// Enhanced selected item visuals via accessors in ScatterplotLayer.

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import { COORDINATE_SYSTEM, OrbitView, LightingEffect, AmbientLight, PointLight, PostProcessEffect } from '@deck.gl/core';
import { DeckProps, DeckGLRef } from '@deck.gl/core/lib/deck';
import { BloomEffect } from '@deck.gl/extensions';

const MOCK_EMBEDDINGS_DECK = [
  { id: 'd_emb_0_1', position: [-60, 20, 10], cluster: 0, name: "Stellar Nucleosynthesis", intensity: 0.9, size: 15 },
  { id: 'd_emb_0_2', position: [-50, 25, 15], cluster: 0, name: "Supernova Remnants", intensity: 1.0, size: 18 },
  { id: 'd_emb_1_1', position: [40, -30, -5], cluster: 1, name: "Deep Sea Vents", intensity: 0.85, size: 14 },
  { id: 'd_emb_1_2', position: [50, -35, 3], cluster: 1, name: "Bioluminescence", intensity: 0.95, size: 17 },
  { id: 'd_emb_0_3', position: [-70, 15, 5], cluster: 0, name: "Nebula Formation", intensity: 0.7, size: 12 },
  { id: 'd_emb_1_3', position: [30, -25, -10], cluster: 1, name: "Hydrothermal Chimneys", intensity: 0.8, size: 16 },
];

const CLUSTER_COLORS_DECK = [
  { primary: [255, 120, 30, 255], secondary: [255, 220, 80, 255] },
  { primary: [30, 150, 255, 255], secondary: [80, 220, 255, 255] },
];

const INITIAL_VIEW_STATE = {
  target: [0, 0, 0], rotationX: 25, rotationOrbit: -35,
  zoom: 1.3, minZoom: 0.4, maxZoom: 8,
};

const ambientLight = new AmbientLight({ color: [230, 230, 255], intensity: 0.7 });
const pointLight1 = new PointLight({ color: [255, 200, 180], intensity: 1.2, position: [-80, -80, 80] });
const pointLight2 = new PointLight({ color: [180, 200, 255], intensity: 0.9, position: [80, 80, 40] });
const lightingEffect = new LightingEffect({ ambientLight, pointLight1, pointLight2 });

const bloomEffect = new BloomEffect({ strength: 0.55, radius: 0.45, threshold: 0.35 });
const postProcessEffect = new PostProcessEffect(bloomEffect, {});


const DeckGLApp: React.FC = () => {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const deckRef = useRef<DeckGLRef>(null);
  const [rendererInfo, setRendererInfo] = useState<string>("Initializing...");

  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      setTime(t => t + 0.015);
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const onViewStateChange = useCallback(({ viewState: newViewState }: { viewState: any }) => {
    setViewState(newViewState);
  }, []);

  const onInitialized = useCallback((deckInstance: DeckGLRef | null) => {
    if (deckInstance?.deck) {
        const lumaDevice = (deckInstance.deck as any).luma?.device;
        if (lumaDevice) {
            const adapterInfo = lumaDevice.info; 
            if (adapterInfo?.type === 'webgpu') {
                setRendererInfo(`WebGPU (${adapterInfo.description || 'LumaGL'})`);
            } else if (adapterInfo?.type === 'webgl' || adapterInfo?.type === 'webgl2') {
                setRendererInfo(`WebGL (${adapterInfo.description || 'LumaGL'})`);
            } else {
                setRendererInfo(adapterInfo?.description || "Unknown (LumaGL)");
            }
            console.log("DeckGLApp: LumaGL Device Info:", adapterInfo);
        } else {
            const gl = (deckInstance.deck as any).gl;
            if (gl) {
                const version = gl.getParameter(gl.VERSION);
                if (typeof version === 'string' && version.toLowerCase().includes('webgl 2')) {
                    setRendererInfo("WebGL 2 (Context)");
                } else if (typeof version === 'string' && version.toLowerCase().includes('webgl')) {
                    setRendererInfo("WebGL 1 (Context)");
                } else {
                    setRendererInfo("WebGL (Context Unknown Version)");
                }
            } else {
                 setRendererInfo("Context Unavailable");
            }
        }
    } else {
         setRendererInfo("Deck Instance Unavailable");
    }
  }, []);


  const layers = useMemo(() => [
    new ScatterplotLayer<any>({ // Explicitly type if your data items have a known interface
      id: 'embedding-geysers', data: MOCK_EMBEDDINGS_DECK,
      getPosition: (d) => d.position,
      getRadius: (d) => d.size * (1 + Math.sin(d.intensity * 6 + time * 4 + d.position[0]) * 0.15) * (selectedItemId === d.id ? 1.25 : 1), 
      getFillColor: (d) => {
        const baseColor = CLUSTER_COLORS_DECK[d.cluster % CLUSTER_COLORS_DECK.length].primary;
        const intensityFactor = (selectedItemId === d.id ? 0.85 : 0.55) + d.intensity * 0.45; 
        return [ baseColor[0] * intensityFactor, baseColor[1] * intensityFactor, baseColor[2] * intensityFactor, (selectedItemId === d.id ? 255 : 190 + d.intensity * 65) ];
      },
      getLineColor: (d) => {
        const baseColor = CLUSTER_COLORS_DECK[d.cluster % CLUSTER_COLORS_DECK.length].secondary;
        return selectedItemId === d.id ? [255,255,255, 255] : [...baseColor.slice(0,3), 190]; 
      },
      lineWidthMinPixels: (d) => selectedItemId === d.id ? 2.5 : 1.0, 
      lineWidthMaxPixels: (d) => selectedItemId === d.id ? 4.0 : 2.5,
      billboard: true, stroked: true,
      pickable: true, 
      onHover: info => setHoverInfo(info),
      onClick: info => setSelectedItemId(prev => prev === info.object?.id ? null : info.object?.id),
      material: { ambient: 0.6, diffuse: 0.7, shininess: 32, specularColor: [200, 200, 220] },
      // updateTriggers are vital if accessors depend on state/props NOT in the `data` prop.
      // Here, selectedItemId is used in accessors, so it should trigger updates.
      // Deck.gl typically handles this by checking if accessor functions themselves change.
      // Explicitly adding `selectedItemId` to the main useMemo deps array for `layers` handles this.
    }),
    new PathLayer<any>({
      id: 'energy-streams',
      data: (() => {
        const paths: any[] = [];
        const activeEmb = MOCK_EMBEDDINGS_DECK.find(e => e.id === selectedItemId);
        MOCK_EMBEDDINGS_DECK.forEach((emb1, i) => {
          for (let j = i + 1; j < MOCK_EMBEDDINGS_DECK.length; j++) {
            const emb2 = MOCK_EMBEDDINGS_DECK[j];
            const isConnectedToSelected = activeEmb && (emb1.id === activeEmb.id || emb2.id === activeEmb.id);
            if (emb1.cluster === emb2.cluster && Math.sqrt(Math.pow(emb1.position[0] - emb2.position[0], 2) + Math.pow(emb1.position[1] - emb2.position[1], 2) + Math.pow(emb1.position[2] - emb2.position[2], 2)) < 45) {
              paths.push({ 
                  path: [emb1.position, emb2.position], 
                  color: CLUSTER_COLORS_DECK[emb1.cluster % CLUSTER_COLORS_DECK.length].secondary,
                  opacity: isConnectedToSelected || !selectedItemId ? 160 : 60 
                });
            }
          }
        });
        return paths;
      })(),
      getPath: (d) => d.path, getColor: (d) => [...d.color.slice(0,3), d.opacity],
      getWidth: 1.8, widthMinPixels: 1.0, widthMaxPixels: 2.8,
      jointRounded: true, capRounded: true,
    }),
  ], [time, selectedItemId]); 

  const deckGLProps: DeckProps = {
    ref: deckRef,
    layers, initialViewState: viewState, onViewStateChange,
    controller: { type: OrbitView, inertia: 200 },
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    effects: [lightingEffect, postProcessEffect],
    parameters: { clearColor: [0.01, 0.005, 0.02, 1], depthTest: true },
    useDevicePixels: true,
    onLoad: () => onInitialized(deckRef.current), // Deck.gl instance is passed here
  };

  return (
    <div style={{ width: '100%', height: '100%', background: '#010002', position: 'relative' }}>
      <style>{`.deck-tooltip { background: rgba(5,0,15,0.9) !important; color: #ddeeff !important; border-radius: 6px !important; padding: 10px 14px !important; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important; font-size: 12.5px !important; box-shadow: 0 3px 12px rgba(0,40,90,0.6) !important; border: 1px solid rgba(40,80,130,0.8) !important; max-width: 280px !important; white-space: pre-wrap !important; pointer-events: none !important; }`}</style>
      <DeckGL {...deckGLProps} />
      {hoverInfo && hoverInfo.object && hoverInfo.object.id !== selectedItemId && (
        <div className="deck-tooltip" style={{ position: 'absolute', left: hoverInfo.x + 8, top: hoverInfo.y + 8, zIndex: 1 }}>
          <div><b>{hoverInfo.object.name}</b></div>
          <div>Cluster: {hoverInfo.object.cluster}</div>
          <div>Intensity: {hoverInfo.object.intensity.toFixed(2)}</div>
        </div>
      )}
       <div style={{ position: 'absolute', bottom: '10px', right: '10px', color: 'rgba(200, 220, 255, 0.8)',
        fontSize: '12px', fontFamily: 'Arial, sans-serif', background: 'rgba(0,5,20,0.7)',
        padding: '5px 10px', borderRadius: '5px', zIndex: 10000, }}>
        <b>Data Geysers (Deck.gl)</b><br />
        Features: Scatterplot/Path Layers, Custom Lighting, Post-Processing (Bloom) <br />
        Renderer: {rendererInfo}
      </div>
    </div>
  );
};
export default DeckGLApp;