import { useEffect, useState } from 'react';
import { initWorkers, InitWorkersResult } from './init';
import useConnectionStore from "../connectionStore";

/**
 * Initializes the Web Workers and a few other elements to connect to the back-end.
 */
function InitializeWorkers() {

    let [retry, setRetry] = useState(true);

    let setWorkersReady = useConnectionStore(state=>state.setWorkersReady);
    let setIdmg = useConnectionStore(state=>state.setIdmg);
    let setCa = useConnectionStore(state=>state.setCa);

    useEffect(()=>{
      // Avoid loop
      if(!retry) return;
      setRetry(false);
  
      console.info("Initializing web workers");
      initWorkers()
        .then((result: InitWorkersResult)=>{
            // Success.
            setIdmg(result.idmg);
            setCa(result.ca);
            // Set the worker state to ready, allows the remainder of the application to load.
            setWorkersReady(true);
        })
        .catch((err: any)=>{
          console.error("Error initializing web workers. Retrying in 15 seconds.", err);
          setTimeout(()=>setRetry(true), 15_000);
        })
  
    }, [retry, setRetry, setWorkersReady])
  
    return <span></span>
}

export default InitializeWorkers;
