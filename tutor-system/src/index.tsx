import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Add global error handlers to catch unhandled promise rejections and errors
window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled promise rejection:', event.reason);
  console.error('🚨 Promise that was rejected:', event.promise);
  
  // Check if this is the JSON-RPC error we're looking for
  if (event.reason && typeof event.reason === 'object') {
    if (event.reason.code === -32603 || event.reason.message?.includes('JSON-RPC')) {
      console.error('🎯 Found the JSON-RPC error!', event.reason);
    }
  }
  
  // Prevent the default browser handling to avoid console spam
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.error('🚨 Global JavaScript error:', {
    message: event.message,
    source: event.filename,
    line: event.lineno,
    column: event.colno,
    error: event.error
  });
});

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
); 