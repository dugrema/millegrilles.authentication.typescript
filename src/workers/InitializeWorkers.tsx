import { useMemo, useEffect } from "react";
import { proxy } from "comlink";

import { ConnectionCallbackParameters } from "./connectionV3";
import useWorkers, { initWorkers, InitWorkersResult } from "./workers";
import useConnectionStore from "../connectionStore";

/**
 * Initializes the Web Workers and a few other elements to connect to the back-end.
 */
function InitializeWorkers() {
  let workersReady = useConnectionStore((state) => state.workersReady);
  let workersRetry = useConnectionStore((state) => state.workersRetry);
  let incrementWorkersRetry = useConnectionStore(
    (state) => state.incrementWorkersRetry
  );
  let setWorkersRetryReady = useConnectionStore(
    (state) => state.setWorkersRetryReady
  );
  let setWorkersReady = useConnectionStore((state) => state.setWorkersReady);
  let setFiche = useConnectionStore((state) => state.setFiche);
  let setUsername = useConnectionStore((state) => state.setUsername);
  let setUserId = useConnectionStore((state) => state.setUserId);
  let setUserSessionActive = useConnectionStore((state) => state.setUserSessionActive);

  let setConnectionReady = useConnectionStore(
    (state) => state.setConnectionReady
  );

  let connectionCallback = useMemo(() => {
    return proxy((params: ConnectionCallbackParameters) => {
      console.debug("Connection params received : ", params);
      setConnectionReady(params.connected);
      if (params.username && params.userId) {
        setUsername(params.username);
        setUserId(params.userId);
      }
    });
  }, [setConnectionReady]);

  // Load the workers with a useMemo that returns a Promise. Allows throwing the promise
  // and catching it with the <React.Suspense> element in index.tsx.
  let workerLoadingPromise = useMemo(() => {
    // Avoid loop, only load workers once.
    if (!workersRetry.retry || workersReady || !connectionCallback) return;
    console.debug("Retry : %O", workersRetry);
    incrementWorkersRetry();

    // Stop loading the page when too many retries.
    if (workersRetry.count > 4) {
      let error = new Error("Too many retries");
      // @ts-ignore
      error.code = 1;
      // @ts-ignore
      error.retryCount = workersRetry.count;
      throw error;
    }

    return fetch('/auth/verifier_usager')
      .then(async (verifUser: Response) => {
        let userStatus = verifUser.status;
        console.debug("User session status : %O", userStatus);
        setUserSessionActive(userStatus === 200);

        let result = await initWorkers(connectionCallback) as InitWorkersResult;
        //.then(async (result: InitWorkersResult) => {
        // Success.
        setFiche(result.idmg, result.ca, result.chiffrage);
        // Set the worker state to ready, allows the remainder of the application to load.
        setWorkersReady(true);
        //})
      })
      .catch((err: any) => {
        console.error(
          "Error initializing web workers. Retrying in 5 seconds.",
          err
        );
        let promise = new Promise((resolve: any) => {
          setTimeout(() => {
            setWorkersRetryReady();
            resolve();
          }, 5_000);
        });
        return promise;
      });
  }, [
    workersReady,
    workersRetry,
    incrementWorkersRetry,
    setWorkersRetryReady,
    setWorkersReady,
    connectionCallback,
  ]);

  if (workerLoadingPromise && !workersReady) throw workerLoadingPromise;

  return <MaintainConnection />;
}

export default InitializeWorkers;

function MaintainConnection() {
    let workers = useWorkers();
    let connectionReady = useConnectionStore((state) => state.connectionReady);
    let userSessionActive = useConnectionStore((state) => state.userSessionActive);
    let username = useConnectionStore((state) => state.username);
    let setMustManuallyAuthenticate = useConnectionStore((state) => state.setMustManuallyAuthenticate);

    useEffect(() => {
        if (!workers) return;
  
        // Start the connection.
        workers.connection.connect()
        .then(() => {
            console.debug("Connected");
        })
        .catch((err) => {
            console.error("Connexion error", err);
        });

    }, [workers]);

    useEffect(() => {
        if(!workers || !connectionReady) return;  // Waiting for a connection

        if(!userSessionActive) {
            // User session is not active. We need to manually authenticate.
            setMustManuallyAuthenticate(true);
            return;
        }

        // There is a user session (cookie).
        if(username) {
            // There is a username in the server session. 
            // Check if we have a valid signing key/certificate for this user.
            let signingKey = null;
            if(signingKey) {
                // Attempt authentication with the current connection.
                throw new Error('todo');
            } else {
                // No key. We need to manually authenticate.
                setMustManuallyAuthenticate(true);
            }
        }

    }, [workers, connectionReady, userSessionActive, setMustManuallyAuthenticate]);

  
    return <span></span>
  }
  