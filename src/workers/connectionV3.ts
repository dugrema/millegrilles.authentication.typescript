import { io, Socket } from 'socket.io-client';
import { certificates, ed25519, messageStruct } from 'millegrilles.cryptography';

const CONST_TRANSPORTS = ['websocket', 'polling'];

export type ConnectionSocketioProps = {
    reconnectionDelay?: number;
};

export type ConnectionCallbackParameters = {
    connected: boolean, 
    username?: string, 
    userId?: string,
};

export default class ConnectionSocketio {
    url: string;
    serverUrl?: string;
    params?: {path: string, reconnection: boolean, transports: Array<string>, reconnectionDelay?: number};
    connectionParams?: {};
    messageSigner?: MessageFactory;
    socket?: Socket;
    certificateStore?: certificates.CertificateStore;
    callback?: (params: ConnectionCallbackParameters) => void;
    opts?: ConnectionSocketioProps;

    /**
     * 
     * @param url 
     * @param ca 
     * @param callback Function to callback when a change occurs (e.g. connect, disconnect, authenticated).
     * @param opts 
     */
    constructor(url: string, ca: string, callback: (params: ConnectionCallbackParameters) => void, opts?: ConnectionSocketioProps) {
        opts = opts || {};
        this.url = url;
        this.opts = opts;

        // Wrap the callback to avoid a comlink error.
        this.callback = (params) => callback(params);

        // Initialize certificate/message validation store and cache
        this.certificateStore = new certificates.CertificateStore(ca);
        this.certificateStore.cache = new certificates.CertificateCache(20);

        this.configureConnection();
    }

    configureConnection() {
        let urlInfo = new URL(this.url);
        let pathSocketio = urlInfo.pathname;
        this.serverUrl = `https://${urlInfo.hostname}`;

        let transports = CONST_TRANSPORTS;

        this.params = {
            path: pathSocketio,
            reconnection: false,
            transports,
        };

        if(this.opts?.reconnectionDelay) {
            this.params.reconnection = true;
            this.params.reconnectionDelay = this.opts.reconnectionDelay;
        }

        console.info("ConnexionSocketio Server : %s, Params %O", this.serverUrl, this.params);
        this.socket = io(this.serverUrl, this.params);

        this.bindSocketioEventHandlers()
    }

    bindSocketioEventHandlers() {
        if(!this.socket) throw new Error('Socket not initialized');

        this.socket.on('connect', () => this.onConnect())
        this.socket.io.on('reconnect_attempt', () => this.onReconnectAttempt())
        this.socket.io.on('reconnect', () => this.onReconnect())
        this.socket.on('disconnect', reason => this.onDisconnect(reason))
        this.socket.on('connect_error', err => this.onConnectError(err))
    }

    onConnect() {
        if(this.callback) this.callback({connected: true});
    }

    onDisconnect(reason: string) {
        if(this.callback) this.callback({connected: false});
        console.warn("Disconnected, reason : ", reason);
    }

    onReconnect() {
        if(this.callback) this.callback({connected: true});
    }

    onReconnectAttempt() {
    }

    onConnectError(err: Error) {
        if(this.callback) this.callback({connected: false});
        console.error("Connection error : ", err);
    }

    /**
     * Connects the socket to the server.
     */
    async connect() {
        if(!this.socket) throw new Error('Socketio is not configured');
        if(this.socket.connected) return true

        return new Promise((resolve, reject)=>{
            // Workaround si aucun callback
            const timeoutConnexion = setTimeout(()=>{
                if(this.socket?.connected) return resolve(true);
                else reject('Connection timeout');
            }, 5_000);

            const callbackHandler = (err?: Error) => {
                clearTimeout(timeoutConnexion)
                if(err) return reject(err)
                resolve(true)
            }

            this.socket?.on('connect', () => {
                callbackHandler();
            })

            this.socket?.on('connect_error', (err: Error) => {
                callbackHandler(err);
            })

            this.socket?.connect();
        })
    
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
