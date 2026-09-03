import './coiBootstrap';
// `standard.css` (wght/wdth/opsz/slnt) rather than `full.css` (those four
// plus GRAD/XOPQ/XTRA/YOPQ/YTAS/YTDE/YTFI/YTLC/YTUC) — the app only varies
// weight, width and optical size (`.display-type`'s font-variation-settings),
// so the eight grid-fitting axes were pure weight with no effect on anything
// rendered. Cuts the fetched Latin file from 320 KB to a smaller subset.
import '@fontsource-variable/roboto-flex/standard.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
