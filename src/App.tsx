import React, {useState, useCallback, useEffect, MouseEventHandler, MouseEvent} from 'react';
import './App.css';

import Loading from './Loading';
import Login, { authenticateConnectionWorker } from './Login';
import InitializeWorkers from './workers/InitializeWorkers';
import InitializeIdb from './idb/InitializeIdb';
import useWorkers from './workers/workers';
import useConnectionStore from "./connectionStore";

const ApplicationList = React.lazy(()=>import('./ApplicationList'));
const ActivateCode = React.lazy(()=>import('./ActivateCode'));
const AddSecurityDevice = React.lazy(()=>import('./AddSecurityDevice'));

function App() {

  const workersReady = useConnectionStore(state=>state.workersReady);
  const workers = useWorkers();

  let logoutHandler: MouseEventHandler<MouseEvent> = useCallback(()=>{
    window.location.href = '/auth/deconnecter_usager';
  }, []);

  useEffect(()=>{
    if(!workersReady || !workers) return;
  }, [workersReady, workers]);

  return (
    <div className="App">
      <header className="App-header h-screen text-slate-300 flex-1 content-center">
        <div className='overflow-scroll'>
          <ContentRouter logout={logoutHandler} />
        </div>
      </header>
      <InitializeWorkers />
      <InitializeIdb />
      <InitialAuthenticationCheck />
    </div>
  );
}

export default App;

type AuthAndContentProps = {
  logout: MouseEventHandler<MouseEvent>,
}

function ContentRouter(props: AuthAndContentProps): JSX.Element {

  let mustManuallyAuthenticate = useConnectionStore(state=>state.mustManuallyAuthenticate);
  let connectionAuthenticated = useConnectionStore(state=>state.connectionAuthenticated);

  let [page, setPage] = useState('ApplicationList');

  let backHandler = useCallback(()=>{
    setPage('');
  }, [setPage]);

  console.debug("ContentRouter mustManuallyAuthenticate %O, connectionAuthenticated %O", mustManuallyAuthenticate, connectionAuthenticated);

  // Override pages depending on authentication state
  if(mustManuallyAuthenticate) return <Login />;
  if(!connectionAuthenticated) return <Loading />;

  // Routed pages
  if(page === 'ActivateCode') {
    return <ActivateCode back={backHandler} />;
  } else if(page === 'AddSecurityDevice') {
    return <AddSecurityDevice back={backHandler} />;
  }

  return (
    <ApplicationList logout={props.logout} setPage={setPage} />
  );
}

let promiseInitialCheck: Promise<void> | null = null;

function InitialAuthenticationCheck() {

    let workers = useWorkers();

    let [initialCheck, setInitialCheck] = useState(true);

    let usernameStore = useConnectionStore(state=>state.username);
    let connectionReady = useConnectionStore((state) => state.connectionReady);
    let userSessionActive = useConnectionStore((state) => state.userSessionActive);
    let setMustManuallyAuthenticate = useConnectionStore((state) => state.setMustManuallyAuthenticate);
    let setConnectionAuthenticated = useConnectionStore((state) => state.setConnectionAuthenticated);

    useEffect(()=>{
        console.debug("Login workers %O, connectionReady: %O", workers, connectionReady);
        if(!initialCheck || !workers || !connectionReady) return;

        promiseInitialCheck = authenticateConnectionWorker(workers, usernameStore, userSessionActive)
            .then(result=>{
                console.debug("Result of authenticateConnectionWorker : ", result);
                if(result.mustManuallyAuthenticate) {
                    setMustManuallyAuthenticate(true);
                    return;
                } else if(result.authenticated) {
                    setMustManuallyAuthenticate(false);
                    setConnectionAuthenticated(true);
                }
            })
            .catch(err=>{
                console.error("Authentication error ", err);
                setMustManuallyAuthenticate(true);
            })
            .finally(()=>{
                setInitialCheck(false);
                promiseInitialCheck = null;
            });
    }, [workers, initialCheck, usernameStore, userSessionActive, connectionReady, setMustManuallyAuthenticate, setConnectionAuthenticated]);

    if(promiseInitialCheck) throw promiseInitialCheck;

    return <span></span>;
}
