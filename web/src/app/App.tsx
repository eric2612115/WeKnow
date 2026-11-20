// Routes. The front page (how WeKnow works) is at /; Ask (the camera) is at /app; every other page is its own chunk.

import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router';
import Shell from './Shell';
import Home from '../pages/Home';
import How from '../pages/How';
import RouteError from './RouteError';
import { loadFresh } from './staleBuild';

const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await loadFresh(load)).default });

/** The front page. Links made when Ask lived here (/?sample=quote) still open Ask with the sample. */
function Front() {
  const loc = useLocation();
  if (new URLSearchParams(loc.search).has('sample')) return <Navigate to={`/app${loc.search}`} replace />;
  return <How />;
}

const router = createBrowserRouter([
  { path: '/', Component: Front, ErrorBoundary: RouteError },
  { path: '/how', element: <Navigate to="/" replace /> },
  {
    Component: Shell,
    ErrorBoundary: RouteError,
    children: [
      { path: 'app', Component: Home },
      { path: 'checks', lazy: page(() => import('../pages/Checks')) },
      { path: 'remembers', lazy: page(() => import('../pages/Remembers')) },
      { path: 'packs', lazy: page(() => import('../pages/Packs')) },
      { path: 'settings', lazy: page(() => import('../pages/Settings')) },
      { path: 'help', lazy: page(() => import('../pages/Help')) },
      { path: 'mail', lazy: page(() => import('../pages/Mail')) },
      // The evaluation harness makes a hundred cloud requests a run: it is for a developer's own project, not the hosted site.
      ...(import.meta.env.DEV ? [{ path: 'eval', lazy: page(() => import('../pages/Eval')) }] : []),
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
