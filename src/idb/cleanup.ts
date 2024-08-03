import { AppWorkers } from "../workers/workers"
import { clearUserCertificate, clearKeys } from './userStoreIdb'

/** 
 * Supprime toutes les idb databases autre que celles de maitre des comptes, vide les cles, et autre storage.
 */
const DATABASES = ['collections', 'documents', 'messagerie']
const CACHE_STORAGE_NAMES = ['fichiersDechiffresTmp']

export default async function cleanup(username: string) {
    if('indexedDB' in window) {

        try {
            await clearUserCertificate(username);
        } catch(err) {
            console.debug("Error during removal of certificate for user %s : %O", username, err);
        }

        try {
            await clearKeys();
        } catch(err) {
            console.debug("Error during removal of decrypted keys: %O", err);
        }

        let databases: Array<string> = DATABASES;
        if('databases' in window.indexedDB) {
            console.debug("Supports indexedDB.databases()")
            try {
                let dbInfo = await window.indexedDB.databases();
                databases = dbInfo.map(item=>item.name).filter(item=>item) as string[];
                console.debug(databases);
            } catch(err) {
                console.warn("Error charge list of databases (%O), using default list of: %O", err, DATABASES)
            }
        }

        // Supprimer databases
        const promisesDelete = []
        for (const databaseName of databases) {
            if(databaseName === 'millegrilles') continue  // Skip DB millegrilles
            const promise = new Promise<void>(resolve=>{
                try {
                    const request = window.indexedDB.deleteDatabase(databaseName)
                    request.onblocked = e=>{
                        console.warn("delete blocked on database %s : %O", databaseName, e)
                    }
                    request.onerror = err => {
                        console.warn("Error deleting database %s : %O", databaseName, err)
                        resolve();
                    }
                    request.onsuccess = () => {
                        resolve();
                    }
                } catch(err) {
                    resolve();
                }
            })
            promisesDelete.push(promise)
        }

        // Remove cache storage
        if(caches) {
            const cacheStorage = caches
            for (const cacheName of CACHE_STORAGE_NAMES) {
                promisesDelete.push( cacheStorage.delete(cacheName) )
            }
        }

        await Promise.all(promisesDelete)

    } else {
        console.debug("IDB non supporte")
    }
}
