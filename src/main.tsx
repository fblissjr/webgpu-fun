// src/main.tsx
import ReactDOM from 'react-dom/client';
import MyTestShell from './MyTestShell.tsx'; // Points to the minimal R3F App

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode> // Keep StrictMode commented for now
    <MyTestShell />
  // </React.StrictMode>,
);