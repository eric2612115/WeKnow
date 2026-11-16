import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter/wght.css';
import './styles.css';
import App from './app/App';
import { watchLook } from './store/prefs';
import { loadData } from './store/data';
import { watchStaleBuild } from './app/staleBuild';

watchStaleBuild();
watchLook();
void loadData();
// Firebase, App Check and the reader load only once Ask is on screen (pages/Home.tsx), never on Welcome.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
