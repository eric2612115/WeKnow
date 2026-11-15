import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter/wght.css';
import './styles.css';
import App from './app/App';
import { watchLook } from './store/prefs';
import { loadData } from './store/data';
import { refreshModel } from './engine/device';

watchLook();
void loadData();
// What this device can do by itself; loaded after the first paint so starting never waits for it.
const later = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));
later(() => void refreshModel());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
