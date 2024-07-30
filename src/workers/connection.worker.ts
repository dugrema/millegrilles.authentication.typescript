import { expose } from 'comlink';
import { forgeCsr } from 'millegrilles.cryptography'
import { ConnectionWorker } from './connectionV3';

import '@solana/webcrypto-ed25519-polyfill';
import apiMapping from '../resources/apiMapping.json';

export class AuthenticationConnectionWorker extends ConnectionWorker {

    async authenticate() {
        if(!this.connection) throw new Error("Connection is not initialized");
        return await this.connection.authenticate(apiMapping);
    }

    async registerAccount(username: string, csr: string): Promise<{ok?: boolean, certificat?: Array<string>}> {
        if(!this.connection) throw new Error("Connection is not initialized");
        return await this.connection.emitWithAck('authentication_register', {nomUsager: username, csr});
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

}

var worker = new AuthenticationConnectionWorker();
expose(worker);
