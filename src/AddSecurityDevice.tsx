import { FormEventHandler, useState, useEffect, useCallback } from 'react';
import useUserStore from './connectionStore';
import useWorkers, { AppWorkers } from './workers/workers';
import { multiencoding } from 'millegrilles.cryptography';
import { RegistrationChallengeType } from './workers/connection.worker';
import { getUser } from './idb/userStoreIdb';

const CLASSNAME_BUTTON = `
    transition ease-in-out 
    min-w-28
    rounded 
    font-bold
    active:bg-indigo-700
    disabled:bg-slate-900 disabled:text-slate-600 disabled:ring-offset-0 disabled:ring-0
    hover:bg-slate-500 hover:ring-offset-1 hover:ring-1
    p-1 m-1
`;

type AddSecurityDeviceProps = {
    back: any,
};

function AddSecurityDevice(props: AddSecurityDeviceProps) {

    let workers = useWorkers();
    let username = useUserStore(state=>state.username);

    let [deactivateOtherKeys, setDeactivateOtherKeys] = useState(false);
    let [challenge, setChallenge] = useState<RegistrationChallengeType>();

    let signChallenge = useCallback(()=>{
        console.debug("Ajout methode pour nomUsager %s, fingerprintPkCourant %O, challenge %O", 
            username, challenge);

        if(!workers || !challenge) return;

        getUser(username)
            .then( async userIdb => {
                let publicKey = userIdb.certificate?.publicKeyString;
                if(!publicKey) throw new Error("Error loading public key for user");
                if(!workers) throw new Error("Workers not ready");
                let addResult = await addMethod(workers, username, publicKey, challenge, deactivateOtherKeys);
                // setResultat('succes')
                // if(confirmationCb) confirmationCb()
            })
            .catch(err=>{
                console.error("Error adding device", err);
                // setResultat('echec')
                // erreurCb(err, 'Erreur ajouter methode')
            });
    }, [workers, username, challenge, deactivateOtherKeys]) as React.MouseEventHandler<HTMLInputElement|HTMLButtonElement>;

    useEffect(()=>{
        if(!workers) return;
        getNewDeviceChallenge(workers)
            .then(result => {
                console.debug("Webauthn registration challenge ", result);
                setChallenge(result);
            })
            .catch(err=>console.error("Error generating webauth challenge", err));
    }, [workers, setChallenge]);

    return (
        <div>
            <div className={'grid grid-cols-1 justify-items-center'}>
                <p className='text-3xl font-bold text-slate-400 pb-10'>Add a security device</p>
                <p>This is for your {username} account.</p>

                <form>
                    <div className='MessageBox min-w-80 border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 text-start space-y-4'>
                        
                        <div>
                            <input 
                                id='deactivate-other-keys' type='checkbox' placeholder="The password if provided." autoComplete="off" required
                                className='bg-slate-700 checked:bg-slate-700 mr-2' 
                                />
                            <label htmlFor='deactivate-other-keys' className='col-span-2'>Also remove <span className='font-semibold'>all other</span> security devices for this account.</label>
                        </div>

                        <div className='flex min-w-full col-span-3 pt-6 justify-center'>
                            <button onClick={signChallenge} className={CLASSNAME_BUTTON+'bg-indigo-700 text-slate-300 '} >Next</button>
                            <button onClick={props.back} className={CLASSNAME_BUTTON+'bg-slate-700 text-slate-300 '}>Cancel</button>
                        </div>
                    </div>
                </form>

            </div>        
        </div>
    );
}

export default AddSecurityDevice;

async function getNewDeviceChallenge(workers: AppWorkers): Promise<RegistrationChallengeType> {
    console.debug("Charger challenge ajouter webauthn");
    
    const hostname = window.location.hostname;
      
    const challengeWebauthn = await workers.connection.generateWebauthChallenge({
        hostname, webauthnRegistration: true
    });

    console.debug("Challenge : %O", challengeWebauthn);

    let challenge = challengeWebauthn.registration_challenge;
    if(!challenge) throw new Error("No challenge received");

    return challenge;
}

async function addMethod(workers: AppWorkers, username: string, publicKey: string, challenge: any, resetMethods: boolean) {
    // NB : Pour que l'enregistrement avec iOS fonctionne bien, il faut que la
    //      thread de l'evenement soit la meme que celle qui declenche
    //      navigator.credentials.create({publicKey}) sous repondreRegistrationChallenge
    if(challenge.publicKey) challenge = challenge.publicKey
    const reponse = await respondRegistrationChallenge(username, challenge);
    console.debug("Reponse ajout webauthn : %O", reponse)

    const hostname = window.location.hostname

    const params = {
        reponseChallenge: reponse,
        fingerprintPk: publicKey,
        hostname,
    } as any;

    if(resetMethods) {
        params.reset_cles = true
    }

    console.debug("reponseChallenge : %O", params)

    const result = await workers.connection.respondChallengeRegistrationWebauthn(params);
    console.debug("Resultat ajout : %O", result)
    if(result.ok !== true) {
        const error = new Error("Error, adding of security device refused (server)")
        // @ts-ignore
        error.response = result
        throw error
    }
}

async function respondRegistrationChallenge(username: string, challengeWebauthn: any) {
    console.debug('repondreRegistrationChallenge nomUsager: %s, attestation: %O', username, challengeWebauthn);
    // Parse options, remplacer base64 par buffer
    const challenge = multiencoding.decodeBase64(challengeWebauthn.challenge);
    const attestation = challengeWebauthn.attestation;
    const userId = multiencoding.decodeBase64(challengeWebauthn.user.id);
  
    const publicKey = {
        ...challengeWebauthn,
        challenge,
        user: {
            ...challengeWebauthn.user,
            id: userId,
            name: username,
            displayName: username,
        }
    };
  
    // Cle publique
    console.debug("Registration options avec buffers : %O", publicKey);
    const newCredential = await navigator.credentials.create({publicKey}) as any;
    console.debug("New credential : %O", newCredential);
  
    // Transmettre reponse
    const credentialResponse = newCredential.response;
    const jsonData = multiencoding.encodeBase64Url(new Uint8Array(credentialResponse.clientDataJSON));
    const attestationObject = multiencoding.encodeBase64Url(new Uint8Array(credentialResponse.attestationObject));
    const data = {
        id: newCredential.id,
        response: {
            attestationObject,
            clientDataJSON: jsonData,
        },
        type: newCredential.type,
    };
  
    return data;
}
