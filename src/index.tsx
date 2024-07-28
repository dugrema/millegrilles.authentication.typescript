import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';

// Global imports
import '@solana/webcrypto-ed25519-polyfill';
import ErrorBoundary from './ErrorBoundary';

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

function Loading() {
  return (
    <div className="App">
      <header className="App-header text-slate-300 flex-1 content-center loading">
        <h1 style={{'paddingTop': '1.5rem', 'paddingBottom': '1.7rem'}}>MilleGrilles</h1>
        <p>The page is loading ...</p>
        <div style={{height: '20vh'}}></div>
      </header>
    </div>
  );
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.unregister();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
