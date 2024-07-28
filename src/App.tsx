import React, {useState, useCallback, useEffect, MouseEventHandler, MouseEvent} from 'react';
import './App.css';

import Loading from './Loading';
import Login from './Login';
import InitializeWorkers from './workers/InitializeWorkers';
import useWorkers from './workers/workers';
import useConnectionStore from "./connectionStore";

const ApplicationList = React.lazy(()=>import('./ApplicationList'));
const ActivateCode = React.lazy(()=>import('./ActivateCode'));
const AddSecurityDevice = React.lazy(()=>import('./AddSecurityDevice'));

function App() {

  const setUsername = useConnectionStore(state=>state.setUsername);
  const workersReady = useConnectionStore(state=>state.workersReady);
  const workers = useWorkers();

  let logoutHandler: MouseEventHandler<MouseEvent> = useCallback(()=>{
    setUsername('');
  }, [setUsername]);

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
