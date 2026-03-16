// file: main.tsx
// Application entry point: renders React root into #root element.
// Imports global styles (Tailwind CSS) and the App component.
// Used by: index.html via script tag.
// This file should stay minimal - all logic belongs in App.tsx.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import '@/styles/globals.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
