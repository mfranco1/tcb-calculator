
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Type declarations for Google Analytics
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

// Initialize Google Analytics only in production
if (import.meta.env.PROD) {
  // Initialize dataLayer and gtag function before loading script
  window.dataLayer = window.dataLayer || [];
  function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  }
  window.gtag = gtag;

  // Load Google Analytics script
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-YYZQGMXK90';
  document.head.appendChild(script);

  // Configure Google Analytics
  gtag('js', new Date());
  gtag('config', 'G-YYZQGMXK90');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
