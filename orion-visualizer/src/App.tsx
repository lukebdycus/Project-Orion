import  { Canvas } from '@react-three/fiber';
import './index.css';
import React, { useRef, useState, ChangeEvent } from 'react';
import { OrbitControls } from '@react-three/drei';
import { SphereGeometry } from 'three';

function App() {
  //const audioContextRef = useRef(null);
  //const audioElement = document.querySelector("audio");
  //const track = audioContext.createMediaElementSource(audioElement);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    console.log(file);
  }

  type NodeProps = {
    position: [number, number, number];
  };

  function Node({ position }: NodeProps) {
    return (
      <mesh position={position}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial
          color="#f5f8f9"
          emissive="#f5f8f9"
          emissiveIntensity={1.5}
        />
      </mesh>
    );
  }

  function NodeField() {
    const nodes: [number, number, number][] = [
      // Center Cluster
      [-0.9, 1.5, 1.9],
      [1.2, -1.8, -0.1],
      [0.9, -0.5, 1.7],
      [0.9, 0.4, -1.2],
      [0.3, 1.2, -1.2],
      [0.6, 1.7, 0.7],
      [1.3, -0.8, 0.7],
      [-1.1, -0.7, -0.5],
      [1.5, 1.5, 1.4],
      [2.0, 1.7, -1.0],
      [1.1, -1.3, 1.5],
      [-0.7, 1.0, -0.8],
      [-0.4, -0.5, -1.7],
      [2.4, 0.0, -0.1],
      [-1.8, 0.5, 1.3],
      [1.7, -1.5, -1.1],
      [0.0, -0.2, 0.3],
      [-1.9, -1.5, -0.4],
      [-0.9, 1.5, -0.8],
      [1.2, 1.1, 0.9],
      [-0.1, -0.7, -0.2],
      [-0.6, 0.4, -1.1],
      [-1.1, -0.7, -1.2],
      [-0.1, -1.3, 0.3],
      [-0.8, 1.4, -1.8],
      [-0.3, 1.3, -0.4],
      [-1.3, 1.5, 0.0],
      [1.1, -0.8, -1.4],
      [-0.1, -1.5, -0.7],
      [1.9, -0.1, 1.7],
      [-1.9, 0.7, 1.4],
      [1.0, -0.4, 2.3],
      [0.0, 0.1, 1.8],
      [1.7, -0.7, 1.1],
      [-0.5, -0.8, -0.5],
      [2.6, 0.2, 0.4],
      [1.8, 0.1, -2.3],
      [1.3, -1.5, -1.9],
      [0.5, -0.6, 1.7],
      [1.0, 2.7, -0.2],
      [-0.6, -0.9, -1.3],
      [1.5, -0.3, 1.7],
      [-1.5, -0.9, -1.2],
      [2.3, -0.9, 0.4],
      [-1.2, 0.7, 0.7],
      [-0.8, -1.2, -1.9],
      [2.6, -0.5, -1.0],
      [1.3, -2.2, 0.6],
      [0.0, -2.2, 0.3],
      [0.0, 1.6, -0.9],
      [0.1, -1.0, -1.7],
      [-1.6, -0.3, 0.9],
      [1.2, 0.9, 1.0],
      [-1.0, 2.0, -0.1],
      [-1.1, 1.9, -1.1],

      // Middle Cluster
      [-1.4, 1.9, 1.6],
      [4.2, -1.0, 0.8],
      [2.6, 2.2, -2.9],
      [-2.4, -0.6, -0.2],
      [3.1, 1.3, 2.5],
      [1.4, -2.0, 1.8],
      [-3.2, -0.6, 3.0],
      [1.5, 1.0, -2.9],
      [-1.4, -0.4, 3.3],
      [-0.4, -2.3, 1.4],
      [-0.1, 0.4, 2.6],
      [1.0, -1.1, -3.6],
      [-3.6, 2.5, 0.6],
      [2.7, 0.4, 4.4],
      [-1.6, 3.3, -2.2],
      [-0.7, 0.7, -2.8],
      [-2.1, 1.7, -1.3],
      [1.0, -3.0, 3.6],
      [1.1, 3.0, 0.0],
      [3.7, -2.8, 1.4],
      [-2.4, -0.5, -0.5],
      [-2.2, 3.1, -2.6],
      [-0.8, -2.3, -1.2],
      [-3.4, 3.2, -0.8],
      [2.2, 1.3, -2.1],
      [3.5, 3.7, -2.6],
      [-0.7, -1.4, -2.9],
      [-3.8, 3.4, 1.6],
      [-0.2, -3.9, -1.1],
      [2.5, -2.4, 4.2],
      [0.4, -4.8, -0.3],
      [0.9, -3.1, -1.3],
      [-4.5, 0.1, -2.3],
      [-2.9, 2.7, -3.8],
      [2.4, 3.5, 0.7],
      [1.1, 4.3, -0.7],
      [0.6, -3.5, -0.3],
      [1.4, -0.7, -2.2],
      [-2.6, 2.4, 2.8],
      [0.5, -3.0, 1.2],
      [-4.7, -2.0, -0.1],
      [-1.7, 4.9, 1.0],
      [0.3, -1.5, 4.0],
      [0.3, -2.1, 3.5],
      [2.8, 1.5, 0.0],
      [-2.8, 1.8, 1.2],
      [-2.5, -3.1, -0.7],
      [-4.2, 0.8, 0.4],
      [-3.0, -1.5, -0.2],
      [3.0, -2.3, -1.6],
      [2.0, 3.8, 2.8],
      [-2.0, -4.4, 2.0],
      [0.8, 0.9, -4.0],
      [-3.5, 2.3, 3.0],
      [-4.4, -0.7, 1.6],

      // Edge Cluster
      [-3.8, -1.5, -3.3],
      [3.6, 3.9, 0.6],
      [-0.3, -6.6, 3.3],
      [-5.6, -1.5, 4.1],
      [-3.7, 4.1, -6.0],
      [3.9, -6.4, 1.8],
      [3.8, 5.6, 1.3],
      [-4.3, 1.7, 2.2],
      [6.2, 0.6, 1.0],
      [-6.3, 0.6, -2.5],
      [3.7, 3.4, 3.4],
      [5.2, -0.2, -5.9],
      [1.3, 6.7, 3.3],
      [1.6, 1.8, -5.3],
      [6.7, 0.7, -3.0],
      [6.5, 3.8, 0.1],
      [-0.5, -6.7, -2.5],
      [-5.2, -1.6, -2.9],
      [-2.6, -6.8, 0.4],
      [-2.3, 5.6, 2.7],
      [-4.2, 1.2, 3.5],
      [3.0, -4.1, -3.4],
      [2.7, -0.5, 4.3],
      [6.5, 0.4, 2.2],
      [-0.8, -3.7, -3.7],
      [-6.2, -2.5, 3.7],
      [-5.8, -3.7, -2.2],
      [4.7, 1.8, -3.8],
    ];

    return (
      <group>
        {nodes.map((position) => (
          <Node position={position} />
        ))}
      </group>
    );
  }

  return (
    <div id="canvas-container">
      <Canvas 
        style={{backgroundColor: 'black'}} 
        camera={{ position: [0, 0, 18], fov:60}}
      >
        {/*Ambient Stuff here*/}
        <ambientLight intensity={6} color="#ffffff" />
        <pointLight position={[3, 3, 3]} intensity={6} color="#ffffff" />

        <NodeField />

        <OrbitControls enableDamping />
      </Canvas>

      <div className="audio-controls">
        <button onClick={openFilePicker}>
          Select Audio File
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,audio/mpeg,audio/wav"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}

export default App;
