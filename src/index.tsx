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


// A global var is set in index.html to allow detecting if we're in a dev environment.
// @ts-ignore
if(GLOBAL_DEV_FLAG) {
   	serviceWorkerRegistration.unregister();
} else {
	// Assume production environment
	serviceWorkerRegistration.register();
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
