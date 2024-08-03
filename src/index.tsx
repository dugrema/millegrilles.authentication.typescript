import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Loading from './Loading';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';

// Global imports
import '@solana/webcrypto-ed25519-polyfill';
import ErrorBoundary from './ErrorBoundary';

const App = React.lazy(()=>import('./App'));

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <React.Suspense fallback={<Loading />}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.Suspense>
  </React.StrictMode>
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.unregister();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
