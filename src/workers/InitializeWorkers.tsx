import { useEffect, useState } from 'react';
import { initWorkers, InitWorkersResult } from './workers';
import useConnectionStore from "../connectionStore";

/**
 * Initializes the Web Workers and a few other elements to connect to the back-end.
 */
function InitializeWorkers() {

    let [retry, setRetry] = useState(true);
    let [retryCount, setRetryCount] = useState(0);

    let setWorkersReady = useConnectionStore(state=>state.setWorkersReady);
    let setIdmg = useConnectionStore(state=>state.setIdmg);
    let setCa = useConnectionStore(state=>state.setCa);

    useEffect(()=>{
      // Avoid loop
      if(!retry) return;
      setRetry(false);

      // Stop loading the page when too many retries.
      if(retryCount > 4) {
        let error = new Error('Too many retries');
        // @ts-ignore
        error.code = 1; error.retryCount = retryCount;
        throw error;
      }
  
      initWorkers()
        .then((result: InitWorkersResult)=>{
            // Success.
            setIdmg(result.idmg);
            setCa(result.ca);
            // Set the worker state to ready, allows the remainder of the application to load.
            setWorkersReady(true);
        })
        .catch((err: any)=>{
          console.error("Error initializing web workers. Retrying in 5 seconds.", err);
          setRetryCount(retryCount+1);
          setTimeout(()=>setRetry(true), 5_000);
        })
  
    }, [retry, setRetry, retryCount, setRetryCount, setWorkersReady])
  
    return <span></span>
}

export default InitializeWorkers;
