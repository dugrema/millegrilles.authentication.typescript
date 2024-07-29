import { expose } from 'comlink';
import '@solana/webcrypto-ed25519-polyfill';
import { forgeCsr, ed25519, messageStruct } from 'millegrilles.cryptography'
import ConnectionSocketio, { ConnectionSocketioProps, ConnectionCallbackParameters } from './connectionV3';

export class AuthenticationConnectionWorker {
    connection?: ConnectionSocketio;

    constructor() {
    }

    async connect() {
        return this.connection?.connect();
    }

    async reconnect() {
        return this.connection?.reconnect();
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

    async prepareMessageFactory(privateKey: Uint8Array, certificate: Array<string>) {
        if(!this.connection) throw new Error("Connection is not initialized");
        let signingKey = await ed25519.messageSigningKeyFromBytes(privateKey, certificate);
        return this.connection.prepareMessageFactory(signingKey);
    }

    async getUserInformation(username: string) {
        if(!this.connection) throw new Error("Connection is not initialized");
        return await this.connection.emitWithAck('getInfoUsager', {nomUsager: username}, {noverif: true});
    }

    async registerAccount(username: string, csr: string): Promise<{ok?: boolean, certificat?: Array<string>}> {
        if(!this.connection) throw new Error("Connection is not initialized");
        return await this.connection.emitWithAck('inscrireUsager', {nomUsager: username, csr});
    }

    async authenticate() {
        if(!this.connection) throw new Error("Connection is not initialized");
        return await this.connection.authenticate();
    }

    /**
     * Wrapper for the forgeCsr.createCsr method.
     * @param username 
     * @param userId 
     * @returns 
     */
    async createCertificateRequest(username: string, userId?: string): Promise<{pem: string, privateKeyPem: string, privateKey: Uint8Array, publicKey: Uint8Array}> {
        return await forgeCsr.createCsr(username, userId);
    }

    async signAuthentication(data: {certificate_challenge: string, activation?: boolean, dureeSession?: number}): Promise<string> {
        // Sign an auth command.
        let command = await this.connection?.createRoutedMessage(
            messageStruct.MessageKind.Command, 
            data, 
            {domaine: 'auth', action: 'authentifier_usager'}
        );
        // Serialize to string
        return JSON.stringify(command);
    }
}

var worker = new AuthenticationConnectionWorker();
expose(worker);
