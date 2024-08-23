import { useMemo, useEffect } from "react";
import { proxy } from "comlink";

import { ConnectionCallbackParameters } from "millegrilles.reactdeps.typescript";
import useWorkers, { AppWorkers, initWorkers, InitWorkersResult } from "./workers";
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
    let setUserSessionActive = useConnectionStore((state) => state.setUserSessionActive);
    let setMustManuallyAuthenticate = useConnectionStore((state) => state.setMustManuallyAuthenticate);

    let setConnectionReady = useConnectionStore(
        (state) => state.setConnectionReady
    );

    let connectionCallback = useMemo(() => {
        return proxy((params: ConnectionCallbackParameters) => {
            setConnectionReady(params.connected);
            if (params.username && params.userId && params.authenticated) {
                setUsername(params.username);
                setUserSessionActive(params.authenticated);
            }
            if(params.authenticated !== undefined && !params.authenticated) {
                setMustManuallyAuthenticate(true);
            }
        });
    }, [setConnectionReady, setMustManuallyAuthenticate, setUsername, setUserSessionActive]);

    // Load the workers with a useMemo that returns a Promise. Allows throwing the promise
    // and catching it with the <React.Suspense> element in index.tsx.
    let workerLoadingPromise = useMemo(() => {
        // Avoid loop, only load workers once.
        if (!workersRetry.retry || workersReady || !connectionCallback) return;
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
                let username = verifUser.headers.get('x-user-name');
                // let userId = verifUser.headers.get('x-user-id');
                setUserSessionActive(userStatus === 200);
                if(username) setUsername(username);

                let result = await initWorkers(connectionCallback) as InitWorkersResult;
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
            setFiche,
            incrementWorkersRetry,
            setWorkersRetryReady,
            setWorkersReady,
            setUserSessionActive,
            setUsername,
            connectionCallback,
    ]);

    if (workerLoadingPromise && !workersReady) throw workerLoadingPromise;

    return <MaintainConnection />;
}

export default InitializeWorkers;

function MaintainConnection() {
    let workers = useWorkers();
    let workersReady = useConnectionStore((state) => state.workersReady);
    
    useEffect(() => {
        if (!workers) return;
  
        // Start the connection.
        workers.connection.connect()
        .catch((err) => {
            console.error("Connection error", err);
        });

    }, [workers]);

    useEffect(()=>{
        if(!workersReady || !workers) return;
        // Start regular maintenance
        let maintenanceInterval = setInterval(()=>{
            if(workers) maintain(workers);
        }, 30_000);
        return () => clearInterval(maintenanceInterval);
    }, [workersReady, workers]);

    return <span></span>
}

/** Regular maintenance on the connection. */
async function maintain(workers: AppWorkers) {
    try {
        await workers.connection.maintain();
    } catch(err) {
        console.error("Error maintaining connection ", err);
    }
}
