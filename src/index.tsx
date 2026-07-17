import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Loading from './Loading';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

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
