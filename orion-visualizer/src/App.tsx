import  { Canvas } from '@react-three/fiber';
import './index.css';
import { OrbitControls } from '@react-three/drei';
import { NodeField } from './visualizer/NodeField';
import { AudioPlayer } from './audio/AudioPlayer';

function App() {
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

      <AudioPlayer />
    </div>
  );
}

export default App;
