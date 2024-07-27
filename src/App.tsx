import React, {useState, useCallback, MouseEventHandler, MouseEvent} from 'react';
import './App.css';

import Login from './Login';
import useUserStore from './userStore';

const ApplicationList = React.lazy(()=>import('./ApplicationList'));
const ActivateCode = React.lazy(()=>import('./ActivateCode'));
const AddSecurityDevice = React.lazy(()=>import('./AddSecurityDevice'));

// let READY = true;

function App() {

  // let [username, setUsername] = useState<string>('');
  const setUsername = useUserStore(state=>state.setUsername);

  let logoutHandler: MouseEventHandler<MouseEvent> = useCallback(()=>{
    setUsername('');
  }, [setUsername]);

  // if(!READY) {
  //   throw new Promise((resolve: any)=>{
  //     setTimeout(()=>{
  //       READY = true;
  //       resolve();
  //     }, 3_000)
  //   })
  // }

  return (
    <div className="App">
      <header className="App-header h-screen text-slate-300 flex-1 content-center">
        <div className='overflow-scroll'>
          <AuthAndContent logout={logoutHandler} />
        </div>
      </header>
    </div>
  );
}

export default App;

type AuthAndContentProps = {
  logout: MouseEventHandler<MouseEvent>,
}

function AuthAndContent(props: AuthAndContentProps): JSX.Element {

  const username = useUserStore(state=>state.username);

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
