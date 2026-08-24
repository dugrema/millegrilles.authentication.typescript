import React, { useEffect } from "react";
import useWorkers, { useWorkerProviderContext, WorkerProvider } from "./WorkerProvider";
import useConnectionStore from "../connectionStore";

export default function InitializeWorkers({ children }: { children: React.ReactNode }) {
    return (
        <WorkerProvider>
            {children}
            <MaintainConnection />
        </WorkerProvider>
    );
}

function MaintainConnection() {
    const workers = useWorkers();
    const workersReady = useConnectionStore((state) => state.workersReady);
    const { loadingPromise } = useWorkerProviderContext();

    useEffect(() => {
        if (!workers || !workersReady) return;

        // Start the connection.
        workers.connection.connect()
        .catch((err) => {
            console.error("Connection error", err);
        });
    }, [workers, workersReady]);

    useEffect(()=>{
        if(!workersReady || !workers) return;
        // Start regular maintenance
        let maintenanceInterval = setInterval(()=>{
            if(workers) maintain(workers);
        }, 30_000);
        return () => clearInterval(maintenanceInterval);
    }, [workersReady, workers]);

    if (loadingPromise && !workersReady) {
        throw loadingPromise;
    }

    return <span></span>
}

/** Regular maintenance on the connection. */
async function maintain(workers: any) {
    try {
        await workers.connection.maintain();
    } catch(err) {
        console.error("Error maintaining connection ", err);
    }
}
