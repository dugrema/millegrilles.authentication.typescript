import { useMemo, useState } from 'react';
import { initWorkers, InitWorkersResult } from './workers';
import useConnectionStore from "../connectionStore";

/**
 * Initializes the Web Workers and a few other elements to connect to the back-end.
 */
function InitializeWorkers() {

    let [retry, setRetry] = useState(true);
    let [retryCount, setRetryCount] = useState(0);

    let workersReady = useConnectionStore(state=>state.workersReady);
    let setWorkersReady = useConnectionStore(state=>state.setWorkersReady);
    let setFiche = useConnectionStore(state=>state.setFiche);

    // Load the workers with a useMemo that returns a Promise. Allows throwing the promise
    // and catching it with the <React.Suspense> element in index.tsx.
    let workerLoadingPromise = useMemo(()=>{
      // Avoid loop, only load workers once.
      setRetry(false);
      if(!retry || workersReady) return;

      // Stop loading the page when too many retries.
      if(retryCount > 4) {
        let error = new Error('Too many retries');
        // @ts-ignore
        error.code = 1; error.retryCount = retryCount;
        throw error;
      }
  
      return initWorkers()
        .then((result: InitWorkersResult)=>{
            // Success.
            setFiche(result.idmg, result.ca, result.chiffrage);
            // Set the worker state to ready, allows the remainder of the application to load.
            setWorkersReady(true);
        })
        .catch((err: any)=>{
          console.error("Error initializing web workers. Retrying in 5 seconds.", err);
          setRetryCount(retryCount+1);
          setTimeout(()=>setRetry(true), 5_000);
        })
  
    }, [retry, workersReady, setRetry, retryCount, setRetryCount, setWorkersReady])
  
    if(workerLoadingPromise && !workersReady) throw workerLoadingPromise;

    return <span></span>
}

export default InitializeWorkers;
