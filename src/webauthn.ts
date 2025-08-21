import { digest, multiencoding } from "millegrilles.cryptography";
import { AuthenticationChallengePublicKeyType, AuthenticationChallengeType } from "./workers/connection.worker";
import stringify from "json-stable-stringify";

export type PrepareAuthenticationResult = {
    publicKey: AuthenticationChallengePublicKeyType, 
    demandeCertificat: any, 
    challengeReference: string,
};

export type DemandeCertificat = {nomUsager: string, csr: string, date: number, activationTierce?: boolean};

export async function prepareAuthentication(
    username: string, challengeWebauthn: AuthenticationChallengeType, csr: string | null, 
    activationTierce: boolean): Promise<PrepareAuthenticationResult> 
{
    if(!challengeWebauthn.publicKey) throw new Error("Challenge without the publicKey field");

    const challengeReference = challengeWebauthn.publicKey.challenge
    const publicKey = {...challengeWebauthn.publicKey} as any

    // Decoder les champs base64url
    publicKey.challenge = multiencoding.decodeBase64Url(publicKey.challenge);
    publicKey.allowCredentials = challengeWebauthn.publicKey.allowCredentials?.map(cred=>{
        const idBytes = multiencoding.decodeBase64Url(cred.id);
        return {
            ...cred,
            id: idBytes
        }
    });

    let demandeCertificat: DemandeCertificat | null = null;
    if(csr) {
        demandeCertificat = {
            nomUsager: username,
            csr,
            date: Math.floor(new Date().getTime()/1000),
        }
        if(activationTierce === true) demandeCertificat.activationTierce = true
        let requestBytes = new TextEncoder().encode(stringify(demandeCertificat));
        const hachageDemandeCert = await digest.digest(requestBytes, {digestName: 'blake2s-256', encoding: 'bytes'});
        if(typeof(hachageDemandeCert) === 'string') throw new Error("Wrong digest response type");
        
        // Concatener le challenge recu (32 bytes) au hachage de la commande
        // Permet de signer la commande de demande de certificat avec webauthn
        const challengeMaj = new Uint8Array(64)
        challengeMaj.set(publicKey.challenge, 0)
        challengeMaj.set(hachageDemandeCert, 32)
        publicKey.challenge = challengeMaj
    } 

    const resultat = { publicKey, demandeCertificat, challengeReference }
    
    return resultat
}

type SignAuthenticationResult = {
    nomUsager: string, 
    demandeCertificat?: any, 
    dureeSession?: number,
    webauthn?: any,
};

export async function signAuthenticationRequest(username: string, demandeCertificat: string, 
    publicKey: any, sessionDuration?: number): Promise<SignAuthenticationResult> 
{
    // const connexion = opts.connexion
    // N.B. La methode doit etre appelee par la meme thread que l'event pour supporter
    //      TouchID sur iOS.
    const publicKeyCredentialSignee = await navigator.credentials.get({publicKey}) as any
    
    const reponseSignee = publicKeyCredentialSignee.response

    const reponseSerialisable = {
        id64: multiencoding.encodeBase64Url(new Uint8Array(publicKeyCredentialSignee.rawId)),
        response: {
            authenticatorData: reponseSignee.authenticatorData?multiencoding.encodeBase64Url(new Uint8Array(reponseSignee.authenticatorData)):null,
            clientDataJSON: reponseSignee.clientDataJSON?multiencoding.encodeBase64Url(new Uint8Array(reponseSignee.clientDataJSON)):null,
            signature: reponseSignee.signature?multiencoding.encodeBase64Url(new Uint8Array(reponseSignee.signature)):null,
            userHandle: reponseSignee.userHandle?multiencoding.encodeBase64Url(new Uint8Array(reponseSignee.userHandle)):null,
        },
        type: publicKeyCredentialSignee.type,
    }

    const data = {
        nomUsager: username, 
        demandeCertificat, 
        webauthn: reponseSerialisable, 
        challenge: publicKey.challenge
    } as SignAuthenticationResult;
    if(sessionDuration) data.dureeSession = sessionDuration;

    return data
}
