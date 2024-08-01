import { expose } from 'comlink';
import { forgeCsr } from 'millegrilles.cryptography'
import { ConnectionWorker, MessageResponse } from './connectionV3';

import '@solana/webcrypto-ed25519-polyfill';
import apiMapping from '../resources/apiMapping.json';

export type AuthenticationChallengePublicKeyType = {
    allowCredentials?: Array<{id: string, type: string}>,
    challenge: string,
    rpId?: string,
    timeout?: number,
    userVerification?: 'string',
};

export type AuthenticationChallengeType = {
    publicKey: AuthenticationChallengePublicKeyType,
};
export type DelegationChallengeType = string;
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

type AddAdministratorRoleResponse = MessageResponse & {
    nomUsager?: string,
    userId?: string,
    compte_prive?: boolean,
    delegation_globale?: string,
    delegations_date?: number,
    delegations_version?: number,
};

type CompteUsagerType = MessageResponse & {
    nomUsager: string,
    userId: string,
    compte_prive?: boolean,
    delegation_globale?: string,
    delegations_date?: number,
    delegations_version?: number,
};

type CurrentUserDetailType = {
    compte?: CompteUsagerType,
    authentication_challenge: AuthenticationChallengeType,
}

export class AuthenticationConnectionWorker extends ConnectionWorker {

    async authenticate(reconnect?: boolean) {
        if(!this.connection) throw new Error("Connection is not initialized");
        return await this.connection.authenticate(apiMapping, reconnect);
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

    async getApplicationList() {
        if(!this.connection) throw new Error("Connection is not initialized");
        return this.connection.sendRequest({}, 'CoreTopologie', 'listeApplicationsDeployees', {eventName: 'request_application_list'});
    }

    /**
     * @returns Current user certificate used for signing messsages.
     */
    async getMessageFactoryCertificate() {
        if(!this.connection) throw new Error("Connection is not initialized");
        return this.connection.getMessageFactoryCertificate();
    }
    
    async addAdministratorRole(command: Object): Promise<AddAdministratorRoleResponse> {
        if(!this.connection) throw new Error("Connection is not initialized");
        return this.connection.sendCommand(command, 'CoreMaitreDesComptes', 'ajouterDelegationSignee');
    }

    async getCurrentUserDetail(username: string, hostname: string): Promise<CurrentUserDetailType> {
        if(!this.connection) throw new Error("Connection is not initialized");
        return await this.connection.sendRequest({nomUsager: username, hostUrl: hostname}, 'CoreMaitreDesComptes', 'chargerUsager') as CurrentUserDetailType;
    }

    async signUserAccount(command: Object): Promise<{certificat?: Array<string>} & MessageResponse> {
        if(!this.connection) throw new Error("Connection is not initialized");
        return await this.connection.sendCommand(command, 'CoreMaitreDesComptes', 'signerCompteUsager');
    }

    async addRecoveryCsr(username: string, csr: string) {
        if(!this.connection) throw new Error("Connection is not initialized");
        return await this.connection.emitWithAck('authentication_addrecoverycsr', {nomUsager: username, csr});
    }
}

var worker = new AuthenticationConnectionWorker();
expose(worker);
