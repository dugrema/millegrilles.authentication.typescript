import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import { 
    initWorkers, 
    terminateWorkers, 
    AppWorkers, 
    InitWorkersResult 
} from "./workers";
import useConnectionStore from "../connectionStore";
import { ConnectionCallbackParameters } from "millegrilles.reactdeps.typescript";

interface WorkerContextType {
    workers: AppWorkers | null;
    isReady: boolean;
    loadingPromise: Promise<void> | null;
}

const WorkerContext = createContext<WorkerContextType | undefined>(undefined);

export function WorkerProvider({ children }: { children: React.ReactNode }) {
    const [workers, setWorkers] = useState<AppWorkers | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [loadingPromise, setLoadingPromise] = useState<Promise<void> | null>(null);

    const workersReady = useConnectionStore((state) => state.workersReady);
    const workersRetry = useConnectionStore((state) => state.workersRetry);
    const incrementWorkersRetry = useConnectionStore((state) => state.incrementWorkersRetry);
    const setWorkersRetryReady = useConnectionStore((state) => state.setWorkersRetryReady);
    const setWorkersReady = useConnectionStore((state) => state.setWorkersReady);
    const setFiche = useConnectionStore((state) => state.setFiche);
    const setUsername = useConnectionStore((state) => state.setUsername);
    const setUserSessionActive = useConnectionStore((state) => state.setUserSessionActive);
    const setMustManuallyAuthenticate = useConnectionStore((state) => state.setMustManuallyAuthenticate);
    const setConnectionReady = useConnectionStore((state) => state.setConnectionReady);

    const connectionCallback = useMemo(() => {
        return ((params: ConnectionCallbackParameters) => {
            setConnectionReady(params.connected);
            if (params.username && params.userId && params.authenticated) {
                setUsername(params.username);
                setUserSessionActive(params.authenticated);
            }
            if (params.authenticated !== undefined && !params.authenticated) {
                setMustManuallyAuthenticate(true);
            }
        }) as (params: ConnectionCallbackParameters) => void;
    }, [setConnectionReady, setMustManuallyAuthenticate, setUsername, setUserSessionActive]);

    const isInitializing = useRef(false);

    useEffect(() => {
        if (isInitializing.current || workersReady || workers) return;
        isInitializing.current = true;

        async function load() {
            try {
                if (workersRetry.count > 0) {
                    throw new Error("Too many retries");
                }

                const promise = fetch('/auth/verifier_usager')
                    .then(async (verifUser: Response) => {
                        const userStatus = verifUser.status;
                        const username = verifUser.headers.get('x-user-name');
                        setUserSessionActive(userStatus === 200);
                        if (username) setUsername(username);

                        const result = await initWorkers(connectionCallback);
                        
                        setFiche(result.idmg, result.ca, result.chiffrage);
                        setWorkersReady(true);
                        setWorkers(result.workers);
                        setIsReady(true);
                    })
                    .catch((err: any) => {
                        console.error("Error initializing web workers. Retrying in 5 seconds.", err);
                        incrementWorkersRetry();
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                setWorkersRetryReady();
                                resolve();
                            }, 5000);
                        });
                    });

                setLoadingPromise(promise);
                await promise;
            } catch (err) {
                console.error("Worker initialization failed", err);
                incrementWorkersRetry();
                setWorkersRetryReady();
            }
        }

        load();

        return () => {
            if (workers) {
                terminateWorkers(workers);
            }
        };
    }, [workersReady, workersRetry, connectionCallback, setFiche, incrementWorkersRetry, setWorkersRetryReady, setWorkersReady, setUserSessionActive, setUsername, setUserSessionActive, setMustManuallyAuthenticate, setConnectionReady]);

    return (
        <WorkerContext.Provider value={{ workers, isReady, loadingPromise }}>
            {children}
        </WorkerContext.Provider>
    );
}

export default function useWorkers() {
    const context = useContext(WorkerContext);
    if (!context) {
        throw new Error("useWorkers must be used within a WorkerProvider");
    }
    return context.workers;
}

export function useWorkerProviderContext() {
    const context = useContext(WorkerContext);
    if (!context) {
        throw new Error("useWorkerProviderContext must be used within a WorkerProvider");
    }
    return context;
}
