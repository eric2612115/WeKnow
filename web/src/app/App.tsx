// Routes. Ask (the camera) is home and loads first; every other page is its own chunk.

import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import Shell from './Shell';
import Home from '../pages/Home';
import RouteError from './RouteError';
import { loadFresh } from './staleBuild';

const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await loadFresh(load)).default });

const router = createBrowserRouter([
  {
    path: '/',
    Component: Shell,
    ErrorBoundary: RouteError,
    children: [
      { index: true, Component: Home },
      { path: 'checks', lazy: page(() => import('../pages/Checks')) },
      { path: 'remembers', lazy: page(() => import('../pages/Remembers')) },
      { path: 'settings', lazy: page(() => import('../pages/Settings')) },
      { path: 'help', lazy: page(() => import('../pages/Help')) },
      { path: 'mail', lazy: page(() => import('../pages/Mail')) },
      { path: 'eval', lazy: page(() => import('../pages/Eval')) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
