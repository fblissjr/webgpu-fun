// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx'; // Points to the minimal R3F App

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode> // Keep StrictMode commented for now
    <App />
  // </React.StrictMode>,
);