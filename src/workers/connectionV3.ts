import { io, Socket } from 'socket.io-client';
import { certificates, ed25519, messageStruct } from 'millegrilles.cryptography';

const CONST_TRANSPORTS = ['websocket', 'polling'];

export type ConnectionSocketioProps = {
    reconnectionDelay?: number;
};

export type ConnectionCallbackParameters = {
    connected: boolean, 
    authenticated?: boolean,
    username?: string, 
    userId?: string,
    idmg?: string,
};

export type EmitWithAckProps = {
    timeout?: number,
    overrideConnected?: boolean,
    noverif?: boolean,
}

export type SendProps = {
    eventName?: string,
    timeout?: number,
    overrideConnected?: boolean,
    noverif?: boolean,
    partition?: string,
    attachments?: Object
}

export type EmitProps = {
    overrideConnected?: boolean,
}

export type RoutedMessageProps = {
    partition?: string,
    nowait?: boolean,
    noverif?: boolean,
}

export type MessageResponse = {
    ok?: boolean,
    err?: string,
    __original?: messageStruct.MilleGrillesMessage,
    __certificate?: certificates.CertificateWrapper,
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
        this.callback = (params) => { callback(params); }

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
        this.onConnectHandler()
            .catch((err: Error)=>console.error("Connection error ", err));
    }

    onDisconnect(reason: string) {
        if(this.callback) this.callback({connected: false});
        console.warn("Disconnected, reason : ", reason);
    }

    onReconnect() {
        if(this.callback) this.callback({connected: true});
        this.onConnectHandler()
            .catch((err: Error)=>console.error("Reconnection error ", err));
    }

    onReconnectAttempt() {
    }

    onConnectError(err: Error) {
        if(this.callback) this.callback({connected: false});
        console.error("Connection error : ", err);
    }

    async onConnectHandler() {
        // Pour la premiere connexion, infoPromise est le resultat d'une requete getEtatAuth.
        const info = await this.emitWithAck('getEtatAuth', {}, {noverif: true, overrideConnected: true});
        console.debug("onConnectHandler info ", info);
        
        if(this.callback) {
            let params: ConnectionCallbackParameters = {connected: true, authenticated: info.auth};
            if(info.username) params.username = info.username;
            if(info.userId) params.userId = info.userId;
            if(info.idmg) params.idmg = info.idmg;
            this.callback(params);
        }
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

    /**
     * Disconnect then reconnect. Used to load a new user session (new auth cookie).
     */
    async reconnect() {
        throw new Error('todo');
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
    prepareMessageFactory(signingKey: ed25519.MessageSigningKey) {
        this.messageSigner = new MessageFactory(signingKey);
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

    /**
     * Methode principale pour emettre un message vers le serveur. Attend une confirmation/reponse.
     * Le message tranmis est signe localement (sauf si inhibe) et la signature de la reponse est verifiee.
     * @param {*} eventName 
     * @param {*} args 
     * @param {*} opts 
     * @returns 
     */
    async emitWithAck(eventName: string, message: Object | null, opts?: EmitWithAckProps) {
        opts = opts || {}
        if(!this.socket) throw new Error('The connection is not configured');
        if(!eventName) throw new TypeError('Event name is null');

        let timeoutDelay = opts.timeout || 9000;
        let overrideConnected = opts.overrideConnected || false;

        if(!overrideConnected && !this.socket.connected) throw new DisconnectedError("connexionClient.emitWithAck Deconnecte");

        let request = this.socket.timeout(timeoutDelay) as any;
        if(message) {
            request = request.emitWithAck(eventName, message);
        } else {
            request = request.emitWithAck(eventName);
        }

        const response = await request as any;
        if(response.sig) {
            return this.verifyResponse(response, opts);
        } else {
            // @ts-ignore
            if(response.err) throw new Error(response.err);  // Server error
            if(opts.noverif) return response;
            else throw new Error("Invalid response");
        }
    }

    /**
     * Methode principale pour emettre un message vers le serveur. Attend une confirmation/reponse.
     * Le message tranmis est signe localement (sauf si inhibe) et la signature de la reponse est verifiee.
     * @param {*} eventName 
     * @param {*} message 
     * @param {*} opts 
     * @returns 
     */
    async emit(eventName: string, message: Object, opts?: EmitProps) {
        opts = opts || {}
        if(!this.socket) throw new Error('pas configure');
        if(!eventName) throw new TypeError('Event name is null');

        let overrideConnected = opts.overrideConnected || false;

        if(!overrideConnected && !this.socket.connected) throw new DisconnectedError();

        if(message) {
            this.socket.volatile.emit(eventName, message)
        } else {
            this.socket.volatile.emit(eventName)
        }

        return true
    }

    async verifyResponse(response: messageStruct.MilleGrillesMessage, opts?: any): Promise<MessageResponse | messageStruct.MilleGrillesMessage> {
        opts = opts || {}
    
        if(opts.noverif) {
            // No verification or parsing of the response.
            return response
        }
    
        if(response.sig && response.certificat) {
            const certificateWrapper = await this.certificateStore?.verifyMessage(response);
            // console.debug("Resultat validation : %O", resultat)
            // Parse le contenu, conserver original
            let content = response as any;
            if(response.kind === 6) {
                // console.info("Reponse chiffree %O", reponse)
                throw new Error('todo - decrypt message');
                // const contenuParsed = await dechiffrerMessage(response);
                // content = contenuParsed;
                // content['__original'] = response;
            } else if(response.contenu) {
                content = JSON.parse(response.contenu);
                content['__original'] = response;
                content['__certificate'] = certificateWrapper;
            }
            return content;
        } else {
            //console.warn("Reponse recue sans signature/cert : ", reponse)
            // return reponse
            throw new Error("Invalid response: the signature is missing");
        }    
    }

    async sendRequest(message: Object, domain: string, action: string, props?: SendProps): Promise<MessageResponse> {
        let routing: {domaine: string, action: string, partition?: string} = {domaine: domain, action};
        if(props?.partition) routing.partition = props.partition;
        let request = await this.messageSigner?.createRoutedMessage(messageStruct.MessageKind.Request, message, routing, new Date());
        if(!request) throw new Error("Error generating request: null");
        if(props?.attachments) request.attachements = props.attachments;
        let eventName = props?.eventName || 'route_message';
        return await this.emitWithAck(eventName, request, props);
    }

    async sendCommand(message: Object, domain: string, action: string, props?: SendProps): Promise<MessageResponse> {
        let routing: {domaine: string, action: string, partition?: string} = {domaine: domain, action};
        if(props?.partition) routing.partition = props.partition;
        let command = await this.messageSigner?.createRoutedMessage(messageStruct.MessageKind.Command, message, routing, new Date());
        if(!command) throw new Error("Error generating command: null");
        if(props?.attachments) command.attachements = props.attachments;
        let eventName = props?.eventName || 'route_message';
        return await this.emitWithAck(eventName, command, props);
    }

    async authenticate(apiMapping?: Object) {
        // Faire une requete pour upgrader avec le certificat
        let challengeResponse = await this.emitWithAck('genererChallengeCertificat', null, {noverif: true});
        let data = {...challengeResponse.challengeCertificat};

        let authenticationResponse = await this.sendCommand(
            data, 'authentication', 'authenticate', 
            {attachments: {apiMapping: apiMapping}, eventName: 'authentication_authenticate'}
        );
        return authenticationResponse.ok === true;
    }
}

export class ConnectionWorker {
    connection?: ConnectionSocketio;

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

/** Facade for the messageStruct create methods. */
class MessageFactory {
    signingKey: ed25519.MessageSigningKey;
    certificate: Array<string> | null;

    constructor(signingKey: ed25519.MessageSigningKey) {
        this.signingKey = signingKey;
        this.certificate = signingKey.getChain();
    }

    async createRoutedMessage(kind: messageStruct.MessageKind, content: Object, routing: messageStruct.Routage, timestamp?: Date) {
        return await messageStruct.createRoutedMessage(this.signingKey, kind, content, routing, timestamp);
    }

    async createResponse(content: Object, timestamp?: Date) {
        return await messageStruct.createResponse(this.signingKey, content, timestamp);
    }
}

export class DisconnectedError extends Error {}
