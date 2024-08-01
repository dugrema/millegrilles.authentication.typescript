import { useState, useCallback, useMemo, useEffect, FormEventHandler, Dispatch } from 'react';
import { FileInput } from 'flowbite-react';
import useConnectionStore from './connectionStore';
import useWorkers, { AppWorkers } from './workers/workers';
import { ActivationCodeResponse, DelegationChallengeType } from './workers/connection.worker';
import { certificates, ed25519, forgeCsr, messageStruct } from 'millegrilles.cryptography';
import { MessageResponse } from './workers/connectionV3';
import { prepareAuthentication, PrepareAuthenticationResult, signAuthenticationRequest } from './Login';

type ActivateCodeProps = {
    back: any,
};

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

function ActivateCode(props: ActivateCodeProps) {

    const username = useConnectionStore(state=>state.username);

    let [uploadKey, setUploadKey] = useState(false);
    let [activationOk, setActivationOk] = useState(false);

    let upladKeyButtonHandler = useCallback(()=>setUploadKey(true), [setUploadKey]);

    let buttonAnotherHandler = useCallback(()=>setActivationOk(false), [setActivationOk]);

    if(uploadKey) return <UploadKey {...props} />;

    return (
        <div className={'grid grid-cols-1 justify-items-center'}>
            <p className='text-3xl font-bold text-slate-400 pb-10'>Activate a code</p>
            <p>This is for your {username} account.</p>

            <div className='MessageBox grid grid-cols-3 min-w-80 max-w-lg border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 justify-items-start'>
                {activationOk?
                    <MessageBoxActivationOk {...props} buttonAnotherHandler={buttonAnotherHandler} />
                    :
                    <MessageBoxForm {...props} setActivationOk={setActivationOk} />
                }
            </div>

            <div className='pt-10'>
                <p>Use the following button if you have received a key in a .json file to upload.</p>
                <button onClick={upladKeyButtonHandler} className={CLASSNAME_BUTTON+'bg-slate-700 text-slate-300 '}>Upload key</button>
            </div>

        </div>
    );
}

export default ActivateCode;

function UploadKey(props: ActivateCodeProps) {

    let workers = useWorkers();

    const username = useConnectionStore(state=>state.username);
    
    let [password, setPassword] = useState('')
    let [invalidKey, setInvalidKey] = useState(false);
    let [installCertificate, setInstallCertificate] = useState(false);
    let [challenge, setChallenge] = useState<DelegationChallengeType>();
    let [uploadedKey, setUploadedKey] = useState<SystemKeyfileType>();

    let uploadKeyHandler = useCallback((e: React.FormEvent<HTMLInputElement>)=>{
        let files = e.currentTarget.files;
        if(!files) throw new Error("No file received");
        let file = files[0];

        file.arrayBuffer()
            .then(fileContent => {
                // Parse the json file content
                let content = new TextDecoder().decode(fileContent);
                let key = JSON.parse(content);
                setUploadedKey(key);
            })
            .catch(err=>console.error("Error parsing key file", err));
    }, [setUploadedKey]);

    let checkKeyHandler = useCallback((e: React.FormEvent<HTMLInputElement>)=>{
        if(!workers || !challenge || !uploadedKey) return;
        activateDelegation(workers, challenge, uploadedKey, password)
            .then(result=>{
                console.debug("Key activation result ", result);
            })
            .catch(err=>console.error("Error activating key ", err));
    }, [workers, challenge, password, uploadedKey, setInvalidKey, setInstallCertificate]) as FormEventHandler;

    let passwordChangeHandler = useCallback((e: React.FormEvent<HTMLInputElement>)=>{
        setPassword(e.currentTarget?e.currentTarget.value:'');
    }, [setPassword]) as FormEventHandler;

    let showInstall = !invalidKey && installCertificate;
    let ready = (password && uploadedKey && challenge)?true:false;

    return (
        <div className={'grid grid-cols-1 justify-items-center'}>
            <p className='text-3xl font-bold text-slate-400 pb-10'>Upload a key</p>
            <p>This is for your {username} account.</p>

            <div className='flex flex-col MessageBox min-w-80 border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 text-start space-y-4'>
                {showInstall?
                    <InstallCertificate {...props} />
                :
                    <UploadKeyForm {...props} 
                        password={password} 
                        passwordChangeHandler={passwordChangeHandler} 
                        invalidKey={invalidKey}
                        checkKeyHandler={checkKeyHandler} 
                        setChallenge={setChallenge} 
                        uploadKey={uploadKeyHandler} 
                        ready={ready} />
                }
                
            </div>

        </div>        
    )
}

type UploadKeyFormProps = {
    back: any,
    password: string,
    invalidKey: boolean,
    passwordChangeHandler: FormEventHandler,
    checkKeyHandler: FormEventHandler,
    setChallenge: Dispatch<DelegationChallengeType>,
    uploadKey: FormEventHandler<HTMLInputElement>,
    ready: boolean,
};

function UploadKeyForm(props: UploadKeyFormProps) {

    let workers = useWorkers();

    let invalidKey = props.invalidKey;
    let setChallenge = props.setChallenge;
    let ready = props.ready;

    let classnameMessageInvalid = useMemo(()=>{
        if(invalidKey) return '';
        return 'hidden';
    }, [invalidKey])

    useEffect(()=>{
        if(!workers) return;
        let hostname = window.location.hostname;
        workers.connection.generateWebauthChallenge({hostname, delegation: true})
            .then(result=>{
                if(result.delegation_challenge) {
                    setChallenge(result.delegation_challenge)
                } else {
                    console.error("No delegation challenge received");
                }
            })
            .catch(err=>{
                console.error("Error retrieving challenge ", err);
                // erreurCb(err, 'Erreur reception challenge de delegation du serveur')
            })
    }, [workers, setChallenge])

    // The password for system keys is a critical piece of security. It must not be saved.
    // Password protection : https://stackoverflow.com/questions/41945535/html-disable-password-manager

    return (
        <>
            <input id='foilautofill' name='foilautofill' type='text' className='hidden' value='DO NOT SAVE' />
            <input name='notautofilledpassword-1' type='password' className='hidden' value='Protecting the password' />
            <input name='notautofilledpassword-2' type='password' className='hidden' value='Protecting the password' />
            <input name='notautofilledpassword-3' type='password' className='hidden' value='Protecting the password' />
            <label htmlFor='real' className='min-w-full'>Password</label>
            <input 
                id='real' type='password' placeholder="The password if provided." autoComplete="new-password"
                value={props.password} onChange={props.passwordChangeHandler}
                className='w-80 bg-slate-700 text-slate-300 hover:bg-slate-500 hover:ring-offset-1 hover:ring-1 focus:bg-indigo-700' 
                />

            <label htmlFor='file-upload'>Key file upload</label>
            <FileInput id='file-upload' sizing='sm' className='w-full max-w-80 overflow-hidden' required accept='application/json'
                onChange={props.uploadKey}
                helperText='Supported format is .json' />

            <div className='flex min-w-full col-span-3 pt-6 justify-center'>
                <button onClick={props.checkKeyHandler} className={CLASSNAME_BUTTON+'bg-indigo-700 text-slate-300'} disabled={!ready}>Next</button>
                <button onClick={props.back} className={CLASSNAME_BUTTON+'bg-slate-700 text-slate-300 '}>Cancel</button>
            </div>

            <div className={classnameMessageInvalid}>
                The key is invalid.
            </div>
        </>
    )
}

function InstallCertificate(props: ActivateCodeProps) {
    return (
        <div>
            <p className='max-w-64 pb-4'>The key is valid. Click on install to start using your new certificate.</p>
            <button onClick={props.back} className={CLASSNAME_BUTTON+'bg-indigo-700 text-slate-300 '}>Install</button>
            <button onClick={props.back} className={CLASSNAME_BUTTON+'bg-slate-700 text-slate-300 '}>Cancel</button>
        </div>
    )
}

type MessageBoxFormProps = {
    back: any,
    setActivationOk: Dispatch<boolean>,
};

function MessageBoxForm(props: MessageBoxFormProps) {

    let workers = useWorkers();
    let username = useConnectionStore(state=>state.username);

    let setActivationOk = props.setActivationOk;

    let [code, setCode] = useState('');
    let [codeRequest, setCodeRequest] = useState<{challenge: String, preparedChallenge: PrepareAuthenticationResult}>()

    useEffect(()=>{
        // Remove any existing request
        setCodeRequest(undefined);

        if(!workers || !code) return;
        if(code.replace('-', '').length !== 8) return;  // The activation code is 8 characters with the dash (-).

        console.debug("Verify code ", code);
        let t = setTimeout(()=>{
            if(!workers) throw new Error('Workers is not initialized');

            workers.connection.verifyRecoveryCode(code)
                .then(async result=>{
                    console.debug("Activation code verification", result);
                    if(result.csr) {
                        if(!workers) throw new Error('Workers is not initialized');
                        let csr = result.csr;

                        // Confirm the username in the CSR (field common name - CN).
                        let usernameCsr = forgeCsr.verifyUserCsr(csr);
                        if(username !== usernameCsr) {
                            throw new Error("CSR is for another user");
                        }

                        // Prepare webauthn signature
                        const hostname = window.location.hostname
                        let reponseChallenge = await workers.connection.generateWebauthChallenge({
                            hostname,
                            webauthnAuthentication: true
                        })
                        console.debug("Challenge webauthn : ", reponseChallenge)
                        const authenticationChallenge = reponseChallenge.authentication_challenge
                        if(!authenticationChallenge) throw new Error('Webauthn challenge was not provided');
                        //setOriginalChallenge(authenticationChallenge.publicKey.challenge)
                        let preparedChallenge = await prepareAuthentication(username, authenticationChallenge, csr, true);
                        console.debug("Challenge webauthn prepare : ", preparedChallenge)
                        setCodeRequest({preparedChallenge, challenge: authenticationChallenge.publicKey.challenge});
                    }
                })
                .catch(err=>console.error("Error verifying activation code: ", err));
        }, 400);
        return () => clearTimeout(t);
    }, [workers, code, setCodeRequest])

    let activateHandler = useCallback(()=>{
        if(!codeRequest) throw new Error("Webauthn request not ready");
        if(!username) throw new Error('Username not provided');

        const {demandeCertificat, publicKey} = codeRequest.preparedChallenge
        const origin = window.location.hostname
        
        signAuthenticationRequest(username, demandeCertificat, publicKey)
            .then(async signatureWebauthn => {
                if(!workers) throw new Error("Workers not initialized");
                if(!codeRequest) throw new Error("Webauthn request not ready");
                console.debug("Resultat signature webauthn : %O", signatureWebauthn)

                const command = {
                    demandeCertificat: signatureWebauthn.demandeCertificat,
                    clientAssertionResponse: signatureWebauthn.webauthn,
                    origin,
                    hostname: origin,
                    challenge: codeRequest.challenge,
                }

                console.debug("Commande demande signature : %O", command)
                const reponse = await workers.connection.signUserAccount(command)
                console.debug("Reponse signature certificat : %O", reponse)

                if(reponse.err) {
                    // setResultatActivation('echec')
                    // erreurCb(reponse.err, "Erreur lors de l'activation du code")
                } else {
                    setActivationOk(true);
                }
            })
            .catch(err=>{
                console.error("Error activating code ", err);
                // setResultatActivation('echec')
                // erreurCb(err)
            })
    }, [workers, codeRequest, setActivationOk])

    let codeChangeHandler = useCallback((e: React.FormEvent<HTMLInputElement>) => setCode(e.currentTarget.value), [setCode]);

    return (
        <>
            <label htmlFor='username' className='justify-self-end pr-4'>Code</label>
            <input 
                id='username' type='text' placeholder="abcd-1234" autoComplete="off" required pattern='^[0-9a-f]{4}-?[0-9a-f]{4}$'
                value={code} onChange={codeChangeHandler}
                className='w-28 col-span-2 bg-slate-700 text-slate-300 hover:bg-slate-500 hover:ring-offset-1 hover:ring-1 focus:bg-indigo-700 invalid:text-red-50 invalid:border-red-500' 
                />

            <div className='flex min-w-full col-span-3 mt-10 justify-center'>
                <button disabled={!codeRequest} onClick={activateHandler}
                    className={CLASSNAME_BUTTON+'bg-indigo-700 text-slate-300 '}>Next</button>
                <button onClick={props.back} className={CLASSNAME_BUTTON+'bg-slate-700 text-slate-300 '}>Cancel</button>
            </div>
        </>
    )
}

type MessageBoxActivationOkProps = {
    back: any,
    buttonAnotherHandler: any,
};

function MessageBoxActivationOk(props: MessageBoxActivationOkProps) {
    return (
        <>
            <p className='col-span-3 w-full'>Code activated successfully.</p>

            <div className='flex min-w-full col-span-3 mt-10 justify-center'>
                <button onClick={props.back} className={CLASSNAME_BUTTON+'bg-indigo-700 text-slate-300 '}>Done</button>
                <button onClick={props.buttonAnotherHandler} className={CLASSNAME_BUTTON+'bg-slate-700 text-slate-300 '}>Another code</button>
            </div>
        </>
    )
}

type SystemKeyfileType = {
    idmg: string,
    racine: {certificat: string, cleChiffree: string}
};

async function activateDelegation(workers: AppWorkers, challenge: DelegationChallengeType, keyFile: SystemKeyfileType, password: string) {

    let privateCaKey = forgeCsr.loadPrivateKey(keyFile.racine.cleChiffree, password);
    let caCertificate = certificates.wrapperFromPems([keyFile.racine.certificat]);
    let caSigningKey = await ed25519.newMessageSigningKey(privateCaKey, caCertificate);

    // Load the username/userId from the current signing certificate in the connexion worker
    let userCertificate = await workers.connection.getMessageFactoryCertificate();
    if(!userCertificate) throw new Error("The connection's message factory is not initialized");
    let username = userCertificate.extensions?.commonName;
    let userId = userCertificate.extensions?.userId;
    if(!username || !userId) throw new Error("The username/userId is missing from the certificate");

    const preuve = await authentiferCleMillegrille(username, userId, caSigningKey, challenge, {activateDelegation: true});

    const command = {
        confirmation: preuve,
        userId,
        nomUsager: username,
        hostname: window.location.hostname,
    }

    let result = await workers.connection.addAdministratorRole(command);
    console.debug("Result ", result);
    if(result.delegation_globale !== 'proprietaire')  {
        console.error("Error delegation ", result);
        throw new Error("Error adding administrator role: " + result.err);
    }

    // Success
}

type CertificateSigningResponseType = {
    challenge: string,
    nomUsager: string,
    userId?: string,
    activerDelegation?: boolean,
};

export async function authentiferCleMillegrille(
    username: string, userId: string, caSigningKey: ed25519.MessageSigningKey, challenge: string, props?: {activateDelegation?: boolean}
): Promise<messageStruct.MilleGrillesMessage> {
    let reponseCertificat: CertificateSigningResponseType = {
      challenge,
      nomUsager: username,
      userId,
    };

    if(props?.activateDelegation) reponseCertificat.activerDelegation = true
 
    let signedMessage = await messageStruct.createDocument(caSigningKey, reponseCertificat);
    delete signedMessage['certificat'];  // Remove the certificate (it's the CA, it is redundant)

    return signedMessage;
}
