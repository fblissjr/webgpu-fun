// @ts-nocheck
// src/App.tsx
// import React from 'react'; // React import removed as it's unused
import { Canvas } from '@react-three/fiber';

// Ensure main.tsx is importing this App component
// And that AppShell is NOT being used in main.tsx for this test

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#333' }}>
      <Canvas>
        <ambientLight intensity={Math.PI / 2} />
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="orange" />
        </mesh>
        {/* OrbitControls can be added later if this works */}
      </Canvas>
      <div style={{ position: 'absolute', top: '10px', left: '10px', color: 'white' }}>
        Minimal R3F App with React 19
      </div>
    </div>
  );
}