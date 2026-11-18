import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import './styles/home.css';
import './styles/chat.css';
import App from './App';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
