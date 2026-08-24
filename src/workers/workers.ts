import {certificates} from "millegrilles.cryptography";
import { Remote, wrap, proxy } from 'comlink';

import { AuthenticationConnectionWorker } from "./connection.worker";
import { ConnectionCallbackParameters } from "millegrilles.reactdeps.typescript";

export type AppWorkers = {
    connection: Remote<AuthenticationConnectionWorker>,
    _rawWorker: Worker,
};

const SOCKETIO_PATH = '/millegrilles/socket.io';

export type InitWorkersResult = {
    idmg: string,
    ca: string,
    chiffrage: Array<Array<string>>,
    workers: AppWorkers,
}

export async function initWorkers(callback: (params: ConnectionCallbackParameters) => void): Promise<InitWorkersResult> {

    const {idmg, ca, chiffrage} = await loadFiche();

    const worker = new Worker(new URL('./connection.worker.ts', import.meta.url), {type: 'module'});
    const connection = wrap(worker) as Remote<AuthenticationConnectionWorker>;

    // Set-up the workers
    const serverUrl = new URL(window.location.href);
    serverUrl.pathname = SOCKETIO_PATH;
    
    const callbackProxy = proxy(callback);
    await connection.initialize(serverUrl.href, ca, callbackProxy, {reconnectionDelay: 7500});

    return {idmg, ca, chiffrage, workers: {connection, _rawWorker: worker}};
}

export function terminateWorkers(workers: AppWorkers) {
    workers._rawWorker.terminate();
}

async function loadFiche(): Promise<LoadFicheResult> {
    let ficheResponse = await fetch('/fiche.json');
    if(ficheResponse.status !== 200) {
        throw new Error(`Loading fiche.json, invalid response (${ficheResponse.status})`)
    }
    let fiche = await ficheResponse.json();

    let content = JSON.parse(fiche['contenu']);
    let {idmg, ca, chiffrage} = content;

    // Verify IDMG with CA
    let idmgVerif = await certificates.getIdmg(ca);
    if(idmgVerif !== idmg) throw new Error("Mismatch IDMG/CA certificate");

    console.info("IDMG: ", idmg);

    // Verify the signature.
    let store = new certificates.CertificateStore(ca);
    if(! await store.verifyMessage(fiche)) throw new Error('While loading fiche.json: signature was rejected.');  // Throws Error if invalid

    // Return the content
    return {idmg, ca, chiffrage};
}

type LoadFicheResult = {
    ca: string,
    idmg: string,
    chiffrage: Array<Array<string>>,
}
