import { useMemo, useEffect } from "react";
import { proxy } from "comlink";

import { ConnectionCallbackParameters } from "./connectionV3";
import useWorkers, { initWorkers, InitWorkersResult } from "./workers";
import useConnectionStore from "../connectionStore";

/**
 * Initializes the Web Workers and a few other elements to connect to the back-end.
 */
function InitializeWorkers() {
  let workers = useWorkers();
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

    return initWorkers(connectionCallback)
      .then(async (result: InitWorkersResult) => {
        // Success.
        setFiche(result.idmg, result.ca, result.chiffrage);
        // Set the worker state to ready, allows the remainder of the application to load.
        setWorkersReady(true);
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

  useEffect(() => {
    if (!workers) return;

    // Start the connection.
    workers.connection
      .connect()
      .then(() => {
        console.debug("Connected");
      })
      .catch((err) => {
        console.error("Connexion error", err);
      });
  }, [workers]);

  if (workerLoadingPromise && !workersReady) throw workerLoadingPromise;

  return <span></span>;
}

export default InitializeWorkers;
