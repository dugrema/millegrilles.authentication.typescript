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
    let setMustManuallyAuthenticate = useConnectionStore((state) => state.setMustManuallyAuthenticate);

    let setConnectionReady = useConnectionStore(
        (state) => state.setConnectionReady
    );

    let connectionCallback = useMemo(() => {
        return proxy((params: ConnectionCallbackParameters) => {
            console.debug("Connection params received : ", params);
            setConnectionReady(params.connected);
            if (params.username && params.userId && params.authenticated) {
                setUsername(params.username);
                setUserId(params.userId);
                setUserSessionActive(params.authenticated);
            }
            if(params.authenticated !== undefined && !params.authenticated) {
                console.debug("setMustManuallyAuthenticate to true");
                setMustManuallyAuthenticate(true);
            }
        });
    }, [setConnectionReady, setMustManuallyAuthenticate, setUsername, setUserId, setUserSessionActive]);

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
                console.debug("Verif user ", verifUser);
                let userStatus = verifUser.status;
                let username = verifUser.headers.get('x-user-name');
                let userId = verifUser.headers.get('x-user-id');
                console.debug("User session status : %O, username: %s, userId: %s", userStatus, username, userId);
                setUserSessionActive(userStatus === 200);
                if(username) setUsername(username);
                if(userId) setUserId(userId);

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
            setUserId,
            connectionCallback,
    ]);

    if (workerLoadingPromise && !workersReady) throw workerLoadingPromise;

    return <MaintainConnection />;
}

export default InitializeWorkers;

function MaintainConnection() {
    let workers = useWorkers();
    
    useEffect(() => {
        if (!workers) return;
  
        // Start the connection.
        workers.connection.connect()
        .then(() => {
            console.debug("Connected");
        })
        .catch((err) => {
            console.error("Connection error", err);
        });

    }, [workers]);

    return <span></span>
}
