import { useEffect } from 'react';
import { openDB } from './userStoreIdb';

let promise: Promise<void> | null = null;

export default function InitializeIdb() {

    useEffect(()=>{
        if(!promise) {
            promise = init()
                .catch(err=>{
                    console.error("Error initializing IDB ", err);
                    throw err
                })
        }
    }, []);

    if(promise) throw promise;  // Throw to prevent screen from rendering. Caught in <React.Suspense> (index.tsx).

    console.debug('InitializeIdb done');
    return <span></span>;
}

async function init() {
    console.debug("Init idb");
    
    // Initialize/upgrade the database
    await openDB(true);

    // Remove promise value, will allow screen to render
    promise = null;
}
