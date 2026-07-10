import  { Canvas } from '@react-three/fiber';
import './index.css';
import React, { useRef, useState, ChangeEvent } from 'react';
import { OrbitControls } from '@react-three/drei';
import { SphereGeometry } from 'three';
import { NodeField } from './visualizer/NodeField';

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
