import  { Canvas } from '@react-three/fiber';
import './index.css';

function App() {
  const audioContextRef = useRef(null);
  const audioElement = document.querySelector("audio");
  const track = audioContext.createMediaElementSource(audioElement);


  return (
    <div id="canvas-container">
      <Canvas style={{backgroundColor: 'black'}}></Canvas>
    </div>
  );
}

export default App;


