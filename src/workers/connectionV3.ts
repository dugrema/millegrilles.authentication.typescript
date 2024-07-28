import { io, Socket } from 'socket.io-client';
import { certificates, ed25519, messageStruct } from 'millegrilles.cryptography';

export type ConnectionSocketioProps = {

};

export type ConnectionCallbackParameters = {
    connected: boolean, 
    username?: string, 
    userId?: string,
}

export default class ConnectionSocketio {
    serverUrl: string;
    connectionParams?: {};
    messageSigner?: MessageFactory;
    socket?: Socket;
    certificateStore?: certificates.CertificateStore;
    callback?: (params: ConnectionCallbackParameters) => void;

    /**
     * 
     * @param serverUrl 
     * @param ca 
     * @param callback Function to callback when a change occurs (e.g. connect, disconnect, authenticated).
     * @param opts 
     */
    constructor(serverUrl: string, ca: string, callback: (params: ConnectionCallbackParameters) => void, opts?: ConnectionSocketioProps) {
        opts = opts || {};
        this.serverUrl = serverUrl;

        // Wrap the callback to avoid a comlink error.
        this.callback = (params) => callback(params);

        // Initialize certificate/message validation store and cache
        this.certificateStore = new certificates.CertificateStore(ca);
        this.certificateStore.cache = new certificates.CertificateCache(20);
    }

    /**
     * Connects the socket to the server.
     */
    async connect() {
        if(this.callback) this.callback({connected: true, username: 'dummy'});
    }

    async maintenance() {
        this.certificateStore?.cache.maintain()
            .catch(err=>{
                console.warn("Erreur during certificate cache maintenance: ", err);
            });
    }

    /**
     * Prepares a message factory for a user (key/certificate).
     * @param signingKey A user's private key
     * @param certificate A user's certificate
     */
    prepareMessageFactory(signingKey: ed25519.MessageSigningKey, certificate: Array<string>) {
        this.messageSigner = new MessageFactory(signingKey, certificate);
    }

    /**
     * Creates and signs a new routed message.
     * @param kind Request (1) or command (2).
     * @param content 
     * @param routing 
     * @param timestamp 
     * @returns 
     */
    async createRoutedMessage(kind: messageStruct.MessageKind, content: Object, routing: messageStruct.Routage, timestamp?: Date) {
        if(!this.messageSigner) throw new Error('Signing key is not loaded');
        return await this.messageSigner.createRoutedMessage(kind, content, routing, timestamp);
    }

    /**
     * Creates and signs a response.
     * @param content 
     * @param timestamp 
     * @returns 
     */
    async createResponse(content: Object, timestamp?: Date) {
        if(!this.messageSigner) throw new Error('Signing key is not loaded');
        return await this.messageSigner.createResponse(content, timestamp);
    }

}

/** Facade for the messageStruct create methods. */
class MessageFactory {
    signingKey: ed25519.MessageSigningKey;
    certificate: Array<string> | null;

    constructor(signingKey: ed25519.MessageSigningKey, certificate: Array<string>) {
        this.signingKey = signingKey;
        this.certificate = certificate;
    }

    async createRoutedMessage(kind: messageStruct.MessageKind, content: Object, routing: messageStruct.Routage, timestamp?: Date) {
        return await messageStruct.createRoutedMessage(this.signingKey, kind, content, routing, timestamp);
    }

    async createResponse(content: Object, timestamp?: Date) {
        return await messageStruct.createResponse(this.signingKey, content, timestamp);
    }
}
