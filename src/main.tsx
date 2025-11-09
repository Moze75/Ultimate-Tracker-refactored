import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ✅ Retrait temporaire du StrictMode pour éviter le double montage qui cause des problèmes avec WebGL/DiceBox
createRoot(document.getElementById('root')!).render(
  <App />
);