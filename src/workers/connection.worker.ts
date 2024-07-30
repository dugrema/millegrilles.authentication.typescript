import { expose } from 'comlink';
import { forgeCsr } from 'millegrilles.cryptography'
import { ConnectionWorker, MessageResponse } from './connectionV3';

import '@solana/webcrypto-ed25519-polyfill';
import apiMapping from '../resources/apiMapping.json';

export type AuthenticationChallengeType = any;
export type DelegationChallengeType = any;
export type RegistrationChallengeType = {
    publicKey: {
        attestation?: string,
        authenticatorSelection?: {requireResidentKey?: boolean, userVerification?: string},
        challenge: string,
        extensions?: any,
        pubKeyCredParams?: Array<{alg: number, type: string}>,
        rp?: {id: string, name: string},
        timeout?: number,
        user?: {displayName?: string, id: string, name: string},
    }
};

export type WebauthChallengeResponse = {
    authentication_challenge?: AuthenticationChallengeType,
    delegation_challenge?: DelegationChallengeType,
    registration_challenge?: RegistrationChallengeType,
};

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

    async respondChallengeRegistrationWebauthn(response: Object): Promise<MessageResponse> {
        if(!this.connection) throw new Error("Connection is not initialized");
        return this.connection.sendCommand(response, 'CoreMaitreDesComptes', 'ajouterCle');
    }

    async generateWebauthChallenge(command: Object): Promise<WebauthChallengeResponse> {
        if(!this.connection) throw new Error("Connection is not initialized");
        let response = this.connection.sendCommand(
            command, 'CoreMaitreDesComptes', 'genererChallenge', {eventName: 'authentication_challenge_webauthn'}) as WebauthChallengeResponse;
        return response;
    }

}

var worker = new AuthenticationConnectionWorker();
expose(worker);
