import { expose } from 'comlink';
import '@solana/webcrypto-ed25519-polyfill';
import ConnectionSocketio, { ConnectionSocketioProps, ConnectionCallbackParameters } from './connectionV3';

export class AuthenticationConnectionWorker {
    connection?: ConnectionSocketio;

    constructor() {
    }

    async connect() {
        return this.connection?.connect();
    }

    async initialize(serverUrl: string, ca: string, callback: (params: ConnectionCallbackParameters) => void, opts?: ConnectionSocketioProps): Promise<boolean> {
        this.connection = new ConnectionSocketio(serverUrl, ca, callback, opts);
        return true;
    }
    
    async ping(): Promise<boolean> {
        console.debug("Ping");
        if(!this.connection) return false;
        return true;
    }
    
}

var worker = new AuthenticationConnectionWorker();
expose(worker);
