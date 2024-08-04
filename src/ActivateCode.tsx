import { useState, useCallback, useMemo, useEffect, FormEventHandler, Dispatch } from 'react';
import { FileInput } from 'flowbite-react';
import useConnectionStore from './connectionStore';
import useWorkers, { AppWorkers } from './workers/workers';
import { DelegationChallengeType } from './workers/connection.worker';
import { certificates, ed25519, forgeCsr, messageStruct } from 'millegrilles.cryptography';
import { prepareAuthentication, PrepareAuthenticationResult, signAuthenticationRequest } from './Login';
import { useTranslation } from 'react-i18next';
import { RenewCertificate } from './ApplicationList';

type ActivateCodeProps = {
    back: any,
};

function ActivateCode(props: ActivateCodeProps) {

    let { t } = useTranslation();

    let username = useConnectionStore(state=>state.username);

    let [uploadKey, setUploadKey] = useState(false);
    let [activationOk, setActivationOk] = useState(false);

    let upladKeyButtonHandler = useCallback(()=>setUploadKey(true), [setUploadKey]);

    let buttonAnotherHandler = useCallback(()=>setActivationOk(false), [setActivationOk]);

    if(uploadKey) return <UploadKey {...props} />;

    return (
        <div className={'grid grid-cols-1 justify-items-center'}>
            <p className='text-3xl font-bold text-slate-400 pb-10'>{t('screens.activateCode.title')}</p>
            <p>{t('labels.yourAccount', {username})}</p>

            <div className='MessageBox grid grid-cols-3 min-w-80 max-w-lg border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 justify-items-start'>
                {activationOk?
                    <MessageBoxActivationOk {...props} buttonAnotherHandler={buttonAnotherHandler} />
                    :
                    <MessageBoxForm {...props} setActivationOk={setActivationOk} />
                }
            </div>

            <div className='pt-10'>
                <p>{t('screens.activateCode.uploadKeyInstructions')}</p>
                <button onClick={upladKeyButtonHandler} 
                    className='btn bg-slate-700 hover:bg-slate-600 active:bg-slate-500' >
                        {t('screens.activateCode.uploadKeyButton')}
                </button>
            </div>

        </div>
    );
}

export default ActivateCode;

function UploadKey(props: ActivateCodeProps) {

    let { t } = useTranslation();
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

        setInvalidKey(false);
        file.arrayBuffer()
            .then(fileContent => {
                // Parse the json file content
                let content = new TextDecoder().decode(fileContent);
                let key = JSON.parse(content);
                setUploadedKey(key);
            })
            .catch(err=>{
                console.error("Error parsing key file", err);
                setInvalidKey(true);
            });
    }, [setUploadedKey, setInvalidKey]);

    let checkKeyHandler = useCallback((e: React.FormEvent<HTMLInputElement>)=>{
        if(!workers || !challenge || !uploadedKey) return;
        activateDelegation(workers, challenge, uploadedKey, password)
            .then(()=>{
                setInstallCertificate(true);
            })
            .catch(err=>{
                console.error("Error activating key ", err);
                setInvalidKey(true);
            });
    }, [workers, challenge, password, uploadedKey, setInvalidKey, setInstallCertificate]) as FormEventHandler;

    let passwordChangeHandler = useCallback((e: React.FormEvent<HTMLInputElement>)=>{
        setInvalidKey(false);
        setPassword(e.currentTarget?e.currentTarget.value:'');
    }, [setPassword, setInvalidKey]) as FormEventHandler;

    let showInstall = !invalidKey && installCertificate;
    let ready = (password && uploadedKey && challenge)?true:false;

    return (
        <div className={'grid grid-cols-1 justify-items-center'}>
            <p className='text-3xl font-bold text-slate-400 pb-10'>{t('screens.activateCode.uploadKey')}</p>
            <p>{t('labels.yourAccount', {username})}</p>

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

    let { t } = useTranslation();

    let workers = useWorkers();

    let invalidKey = props.invalidKey;
    let setChallenge = props.setChallenge;
    let ready = props.ready;

    let classnameMessageInvalid = useMemo(()=>{
        if(invalidKey) return '';
        return 'hidden';
    }, [invalidKey])

    let ignoreHandler = useCallback(()=>{}, []);  // Prevents react warning

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
            <input id='foilautofill' name='foilautofill' type='text' className='hidden' value='DO NOT SAVE' onChange={ignoreHandler}/>
            <input name='notautofilledpassword-1' type='password' className='hidden' value='Protecting the password' onChange={ignoreHandler} />
            <input name='notautofilledpassword-2' type='password' className='hidden' value='Protecting the password' onChange={ignoreHandler}/>
            <input name='notautofilledpassword-3' type='password' className='hidden' value='Protecting the password' onChange={ignoreHandler}/>
            <label htmlFor='real' className='min-w-full'>{t('labels.password')}</label>
            <input 
                id='real' type='password' placeholder={t('screens.activateCode.passwordPlaceholder')} autoComplete="new-password"
                value={props.password} onChange={props.passwordChangeHandler}
                className='w-80 bg-slate-700 text-slate-300 hover:bg-slate-500 hover:ring-offset-1 hover:ring-1 focus:bg-indigo-700' 
                />

            <label htmlFor='file-upload'>{t('screens.activateCode.keyFileUpload')}</label>
            <FileInput id='file-upload' sizing='sm' className='w-full max-w-80 overflow-hidden' required accept='application/json'
                onChange={props.uploadKey}
                helperText={t('screens.activateCode.formatIsJson')} />

            <div className='w-80 h-8'>
                <p className={classnameMessageInvalid}>{t('screens.activateCode.invalidKey')}</p>
            </div>

            <div className='flex min-w-full col-span-3 pt-4 justify-center'>
                <button onClick={props.checkKeyHandler} disabled={!ready}
                    className='btn bg-indigo-800 hover:bg-indigo-600 active:bg-indigo-500'>
                        {t('buttons.next')}
                </button>
                <button onClick={props.back} className='btn bg-slate-700 hover:bg-slate-600 active:bg-slate-500'>
                        {t('buttons.cancel')}
                </button>
            </div>
        </>
    )
}

function InstallCertificate(props: ActivateCodeProps) {

    let { t } = useTranslation();
    let back = props.back;

    let onSuccessHandler = useCallback(()=>{
        back()
    }, [back]);

    return (
        <div>
            <p className='max-w-64 pb-4'>{t('screens.activateCode.validKey')}</p>
            <RenewCertificate buttonOnly={true} onSuccess={onSuccessHandler} 
                className='bg-indigo-800 hover:bg-indigo-600 active:bg-indigo-500' />
            <button onClick={back}
                className='btn bg-slate-700 hover:bg-slate-600 active:bg-slate-500'>
                    {t('buttons.cancel')}
            </button>
        </div>
    )
}

type MessageBoxFormProps = {
    back: any,
    setActivationOk: Dispatch<boolean>,
};

function MessageBoxForm(props: MessageBoxFormProps) {

    let { t } = useTranslation();
    let workers = useWorkers();
    let username = useConnectionStore(state=>state.username);

    let setActivationOk = props.setActivationOk;

    let [code, setCode] = useState('');
    let [codeRequest, setCodeRequest] = useState<{challenge: String, preparedChallenge: PrepareAuthenticationResult}>()
    let [invalidCode, setInvalidCode] = useState(false);
    let [disabled, setDisabled] = useState(false);

    useEffect(()=>{
        // Remove any existing request
        setCodeRequest(undefined);
        setInvalidCode(false);
        setDisabled(true);

        if(!workers || !code) return;
        if(code.replace('-', '').length !== 8) return;  // The activation code is 8 characters with the dash (-).

        let t = setTimeout(()=>{
            if(!workers) throw new Error('Workers is not initialized');

            workers.connection.verifyRecoveryCode(code)
                .then(async result=>{
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
                        const authenticationChallenge = reponseChallenge.authentication_challenge
                        if(!authenticationChallenge) throw new Error('Webauthn challenge was not provided');
                        let preparedChallenge = await prepareAuthentication(username, authenticationChallenge, csr, true);
                        setCodeRequest({preparedChallenge, challenge: authenticationChallenge.publicKey.challenge});
                    } else {
                        // Unknown code
                        setInvalidCode(true);
                    }
                })
                .catch(err=>console.error("Error verifying activation code: ", err))
                .finally(()=>setDisabled(false));
        }, 400);
        return () => clearTimeout(t);
    }, [workers, username, code, setCodeRequest, setInvalidCode, setDisabled])

    let activateHandler = useCallback((e: React.FormEvent)=>{
        e.preventDefault();
        e.stopPropagation();
        if(!codeRequest) throw new Error("Webauthn request not ready");
        if(!username) throw new Error('Username not provided');

        const {demandeCertificat, publicKey} = codeRequest.preparedChallenge
        const origin = window.location.hostname
        
        setDisabled(true);
        signAuthenticationRequest(username, demandeCertificat, publicKey)
            .then(async signatureWebauthn => {
                if(!workers) throw new Error("Workers not initialized");
                if(!codeRequest) throw new Error("Webauthn request not ready");

                const command = {
                    demandeCertificat: signatureWebauthn.demandeCertificat,
                    clientAssertionResponse: signatureWebauthn.webauthn,
                    origin,
                    hostname: origin,
                    challenge: codeRequest.challenge,
                }

                const reponse = await workers.connection.signUserAccount(command)

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
            .finally(()=>setDisabled(false));
    }, [workers, username, codeRequest, setActivationOk])

    let codeChangeHandler = useCallback((e: React.FormEvent<HTMLInputElement>) => setCode(e.currentTarget.value), [setCode]);

    let informationMessage;
    if(invalidCode) informationMessage = <span>{t('screens.activateCode.invalidCode')}</span>;
    else if(codeRequest) informationMessage = <span>{t('screens.activateCode.validCode')}</span>;
    else informationMessage = <span>{t('screens.activateCode.enterCode')}</span>;

    return (
        <form onSubmit={activateHandler} className='grid grid-cols-3 col-span-3'>
            <label htmlFor='username' className='justify-self-end pr-4'>{t('screens.activateCode.code')}</label>
            <input 
                id='username' type='text' placeholder="abcd-1234" autoComplete="off" required pattern='^[0-9a-f]{4}-?[0-9a-f]{4}$' maxLength={9}
                value={code} onChange={codeChangeHandler}
                className='w-28 col-span-2 bg-slate-700 text-slate-300 hover:bg-slate-500 hover:ring-offset-1 hover:ring-1 focus:bg-indigo-700 invalid:text-red-50 invalid:border-red-500' 
                />

            <div className='flex col-span-3 mt-6 justify-center min-h-14 w-56 items-center'>{informationMessage}</div>

            <div className='flex min-w-full col-span-3 mt-6 justify-center'>
                <input type='submit' disabled={disabled || !codeRequest} value={t('buttons.next')}
                    className='btn bg-indigo-800 hover:bg-indigo-600 active:bg-indigo-500' />
                <button onClick={props.back} 
                    className='btn bg-slate-700 hover:bg-slate-600 active:bg-slate-500'>
                        {t('buttons.cancel')}
                </button>
            </div>
        </form>
    )
}

type MessageBoxActivationOkProps = {
    back: any,
    buttonAnotherHandler: any,
};

function MessageBoxActivationOk(props: MessageBoxActivationOkProps) {
    let { t } = useTranslation();
    return (
        <>
            <p className='col-span-3 w-full'>{t('screens.activateCode.successfulCode')}</p>

            <div className='flex min-w-full col-span-3 mt-10 justify-center'>
                <button onClick={props.back} 
                    className='btn bg-indigo-800 hover:bg-indigo-600 active:bg-indigo-500'>
                        {t('buttons.done')}
                </button>
                <button onClick={props.buttonAnotherHandler}
                    className='btn bg-indigo-800 hover:bg-indigo-600 active:bg-indigo-500'>
                        {t('screens.activateCode.anotherCode')}
                </button>
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

    const preuve = await authenticateCleMillegrille(username, userId, caSigningKey, challenge, {activateDelegation: true});

    const command = {
        confirmation: preuve,
        userId,
        nomUsager: username,
        hostname: window.location.hostname,
    }

    let result = await workers.connection.addAdministratorRole(command);
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

export async function authenticateCleMillegrille(
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
