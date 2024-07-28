import {expose} from 'comlink';
// import { digest, encryption, random, multiencoding, certificates, ed25519, messageStruct, x25519 } from 'millegrilles.cryptography';
import '@solana/webcrypto-ed25519-polyfill';

async function ping(): Promise<boolean> {
    console.debug("Ping");
    return false;
}

export interface ConnectionWorkerInterface {
    ping(): Promise<boolean>,
}

expose({ping});
