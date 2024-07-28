import React, {useState, useCallback, useEffect, MouseEventHandler, MouseEvent} from 'react';
import './App.css';

import Login from './Login';
import InitializeWorkers from './workers/InitializeWorkers';
import useWorkers from './workers/workers';
import useConnectionStore from "./connectionStore";

const ApplicationList = React.lazy(()=>import('./ApplicationList'));
const ActivateCode = React.lazy(()=>import('./ActivateCode'));
const AddSecurityDevice = React.lazy(()=>import('./AddSecurityDevice'));

// let READY = true;

function App() {

  // let [username, setUsername] = useState<string>('');
  const setUsername = useConnectionStore(state=>state.setUsername);
  const workersReady = useConnectionStore(state=>state.workersReady);
  const workers = useWorkers();

  let logoutHandler: MouseEventHandler<MouseEvent> = useCallback(()=>{
    setUsername('');
  }, [setUsername]);

  useEffect(()=>{
    if(!workersReady || !workers) return;
    // workers.connection.ping()
    //   .then((result: boolean)=>{
    //     console.debug("Ping ", result);
    //   })
    //   .catch(err=>console.error("Error in ping: ", err))
  }, [workersReady, workers]);

  return (
    <div className="App">
      <header className="App-header h-screen text-slate-300 flex-1 content-center">
        <div className='overflow-scroll'>
          <AuthAndContent logout={logoutHandler} />
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

function AuthAndContent(props: AuthAndContentProps): JSX.Element {

  const username = useConnectionStore(state=>state.username);

  let [page, setPage] = useState('ApplicationList');

  let backHandler = useCallback(()=>{
    setPage('');
  }, [setPage]);

  if(!username) return <Login />

  if(page === 'ActivateCode') {
    return <ActivateCode back={backHandler} />;
  } else if(page === 'AddSecurityDevice') {
    return <AddSecurityDevice back={backHandler} />;
  }

  return (
    <ApplicationList username={username} logout={props.logout} setPage={setPage} />
  )
}
