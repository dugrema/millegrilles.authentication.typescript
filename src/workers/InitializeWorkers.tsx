import { useMemo, useEffect } from "react";
import { proxy } from "comlink";

import { ConnectionCallbackParameters } from "millegrilles.reactdeps.typescript";
import useWorkers, { AppWorkers, initWorkers, InitWorkersResult } from "./workers";
import useConnectionStore from "../connectionStore";

/**
 * Initializes the Web Workers and a few other elements to connect to the back-end.
 */
function InitializeWorkers() {
    const workersReady = useConnectionStore((state) => state.workersReady);
    const workersRetry = useConnectionStore((state) => state.workersRetry);
    const incrementWorkersRetry = useConnectionStore(
        (state) => state.incrementWorkersRetry
    );
    const setWorkersRetryReady = useConnectionStore(
        (state) => state.setWorkersRetryReady
    );
    const setWorkersReady = useConnectionStore((state) => state.setWorkersReady);
    const setFiche = useConnectionStore((state) => state.setFiche);
    const setUsername = useConnectionStore((state) => state.setUsername);
    const setUserSessionActive = useConnectionStore((state) => state.setUserSessionActive);
    const setMustManuallyAuthenticate = useConnectionStore((state) => state.setMustManuallyAuthenticate);

    const setConnectionReady = useConnectionStore((state) => state.setConnectionReady);

    const connectionCallback = useMemo(() => {
        return proxy((params: ConnectionCallbackParameters) => {
            // console.debug("Connection callback", params);
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
    const workerLoadingPromise = useMemo(() => {
        // Avoid loop, only load workers once.
        if (!workersRetry.retry || workersReady || !connectionCallback) return;
        incrementWorkersRetry();

        // Stop loading the page when too many retries.
        if (workersRetry.count > 4) {
            const error = new Error("Too many retries");
            // @ts-ignore
            error.code = 1;
            // @ts-ignore
            error.retryCount = workersRetry.count;
            throw error;
        }

        return fetch('/auth/verifier_usager')
            .then(async (verifUser: Response) => {
                // console.debug("Response verifier usager: %O", verifUser);
                const userStatus = verifUser.status;
                const username = verifUser.headers.get('x-user-name');
                // let userId = verifUser.headers.get('x-user-id');
                setUserSessionActive(userStatus === 200);
                if(username) setUsername(username);

                const result = await initWorkers(connectionCallback) as InitWorkersResult;
                // console.debug("Fiche recue: %O", result);
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
                const promise = new Promise((resolve: any) => {
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
    const workers = useWorkers();
    const workersReady = useConnectionStore((state) => state.workersReady);
    
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
