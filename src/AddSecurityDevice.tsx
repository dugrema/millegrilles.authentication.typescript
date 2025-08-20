import { useState, useEffect, useCallback, Dispatch, ChangeEvent } from 'react';
import useUserStore from './connectionStore';
import useWorkers, { AppWorkers } from './workers/workers';
import { multiencoding } from 'millegrilles.cryptography';
import { RegistrationChallengeType, TotpSecretType } from './workers/connection.worker';
import { getUser } from './idb/userStoreIdb';
import { useTranslation } from 'react-i18next';

type AddSecurityDeviceProps = {
    back: any,
};

function AddSecurityDevice(props: AddSecurityDeviceProps) {

    let { t } = useTranslation();
    let username = useUserStore(state=>state.username);
    let [deactivateOtherKeys, setDeactivateOtherKeys] = useState(false);
    let [confirm, setConfirm] = useState(false);

    let pageContent;
    if(confirm) pageContent = <AddDeviceConfirmation {...props} setConfirm={setConfirm} deactivateOtherKeys={deactivateOtherKeys} setDeactivateOtherKeys={setDeactivateOtherKeys} />;
    else pageContent = <AddDeviceContent {...props} setConfirm={setConfirm} deactivateOtherKeys={deactivateOtherKeys} setDeactivateOtherKeys={setDeactivateOtherKeys}/>;

    return (
        <div>
            <div className={'grid grid-cols-1 justify-items-center'}>
                <p className='text-3xl font-bold text-slate-400 pb-10'>{t('screens.applicationList.addSecurityDevice')}</p>
                <p>This is for your {username} account.</p>

                <div className='MessageBox min-w-80 mx-2 border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 text-start space-y-4'>
                    {pageContent}
                </div>

            </div>        
        </div>
    );
}

export default AddSecurityDevice;

type AddDeviceContentType = AddSecurityDeviceProps & {
    deactivateOtherKeys: boolean,
    setDeactivateOtherKeys: Dispatch<boolean>,
    setConfirm: Dispatch<boolean>,
};

function AddDeviceContent(props: AddDeviceContentType) {

    let setConfirm = props.setConfirm;

    let { deactivateOtherKeys, setDeactivateOtherKeys } = props;

    let { t } = useTranslation();
    let workers = useWorkers();
    let username = useUserStore(state=>state.username);
    let setConnectionInsecure = useUserStore(state=>state.setConnectionInsecure);

    let [challenge, setChallenge] = useState<RegistrationChallengeType>();
    const [totpCode, setTotpCode] = useState('');
    const [totpQrBase64, setTotpQrBase64] = useState('');
    const [totpCorrelation, setTotpCorrelation] = useState('');
    let [disabled, setDisabled] = useState(false);
    let [failed, setFailed] = useState(false);

    const totpCodeOnChange = useCallback((e: ChangeEvent<HTMLInputElement>)=>{setTotpCode(e.currentTarget.value)}, [setTotpCode]);

    let deactivateOtherKeysHandler = useCallback((e: React.FormEvent<HTMLInputElement>)=>{
        setDeactivateOtherKeys(!!e.currentTarget.checked);
    }, [setDeactivateOtherKeys]);

    let signChallenge = useCallback(()=>{
        if(!workers || (!challenge && !totpCode)) return;

        setDisabled(true);
        setFailed(false);
        getUser(username)
            .then( async userIdb => {
                let publicKey = userIdb?.certificate?.publicKeyString;
                if(!publicKey) throw new Error("Error loading public key for user");
                if(!workers) throw new Error("Workers not ready");
                
                if(totpCode && totpCorrelation) {
                    // Add using authenticator code
                    await registerTotpCode(workers, totpCode, totpCorrelation);
                } else {
                    // Add new webauthn credential
                    await addMethod(workers, username, publicKey, challenge, deactivateOtherKeys);
                }

                setConfirm(true);
                setConnectionInsecure(false);  // Ensure the flag is removed
            })
            .catch(err=>{
                console.error("Error adding device", err);
                setFailed(true);
                // setResultat('echec')
                // erreurCb(err, 'Erreur ajouter methode')
            })
            .finally(()=>{
                setDisabled(false);
                setTotpCode('');  // Reset TOTP code
            });
    }, [workers, username, challenge, deactivateOtherKeys, totpCode, totpCorrelation, setDisabled, setFailed, setConfirm, setConnectionInsecure, setTotpCode]) as React.MouseEventHandler<HTMLInputElement|HTMLButtonElement>;

    useEffect(()=>{
        if(!workers) return;
        getNewTotpChallenge(workers, username)
            .then(response=>{
                // console.debug("Response", response);
                setTotpQrBase64('data:image/jpeg;base64,' + response.qr_base64);
                setTotpCorrelation(response.correlation);
            })
            .catch(err=>console.error("Error getting a new TOTP secret", err));
        getNewDeviceChallenge(workers)
            .then(result => {
                setChallenge(result);
            })
            .catch(err=>console.error("Error generating webauth challenge", err));
    }, [workers, setTotpQrBase64, setTotpCorrelation]);

    return (
        <>
            <div>
                <input 
                    id='deactivate-other-keys' type='checkbox' placeholder="The password if provided." autoComplete="off" required
                    checked={deactivateOtherKeys} onChange={deactivateOtherKeysHandler}
                    className='bg-slate-700 checked:bg-slate-700 mr-2' 
                    />
                <label htmlFor='deactivate-other-keys' className='col-span-2'>Also remove <span className='font-semibold'>all other</span> security devices for this account.</label>
            </div>
            
            <div className='h-30 justify-items-center max-w-96'>
                {failed?
                    <p>An error occurred, the device was not added. You may try again later.</p>
                    :
                    <>
                        <p>Click on {t('buttons.next')} to add a new security key (USB, NFC, Mobile, etc.).</p>
                        <p className='pt-2 h-10 text-center'>OR</p>
                        <p>Use this QR code with your Authenticator App and enter the displayed 6 digit value. Then click on {t('buttons.next')}.</p>
                        <div className='grid grid-cols-2 pt-2'>
                            <img className='col-span-2' src={totpQrBase64} alt='Authenticator QR Code' />
                            <label htmlFor="totp-code">Authenticator App Code</label>
                            <input id="totp-code" placeholder='Ex.: 123456' value={totpCode} onChange={totpCodeOnChange} />
                            <p className='col-span-2 text-sm'>Leave empty to add security key (e.g. USB, NFC, Mobile).</p>
                        </div>
                    </>
                }
            </div>

            <div className='grid col-span-1 pt-4 justify-items-center'>
                <div>
                    <button onClick={signChallenge} disabled={disabled} 
                        className='btn bg-indigo-800 hover:bg-indigo-600 active:bg-indigo-500'>
                        {t('buttons.next')}
                    </button>
                    <button onClick={props.back}
                        className='btn bg-slate-700 hover:bg-slate-600 active:bg-slate-500' >
                            {t('buttons.cancel')}
                    </button>
                </div>
            </div>
        </>
    );
}

function AddDeviceConfirmation(props: AddDeviceContentType) {

    let {t} = useTranslation();
    let { setConfirm, setDeactivateOtherKeys } = props;
    let anotherHandler = useCallback(()=>{
        setConfirm(false);
        setDeactivateOtherKeys(false);
    }, [setConfirm, setDeactivateOtherKeys]);

    return (
        <>
            <p className="max-w-96">
                The security device was added successfully.
                {props.deactivateOtherKeys?<span> All other security devices were removed.</span>:<span></span>}
            </p>

            <div className='grid col-span-1 pt-4 justify-items-center'>
                <div>
                    <button onClick={anotherHandler}
                        className='btn bg-indigo-800 hover:bg-indigo-600 active:bg-indigo-500'>
                        {t('buttons.addAnother')}
                    </button>
                    <button onClick={props.back}
                        className='btn bg-slate-700 hover:bg-slate-600 active:bg-slate-500' >
                            {t('buttons.done')}
                    </button>
                </div>
            </div>
        </>
    )
}

async function getNewDeviceChallenge(workers: AppWorkers): Promise<RegistrationChallengeType> {
    const hostname = window.location.hostname;
      
    const challengeWebauthn = await workers.connection.generateWebauthChallenge({
        hostname, webauthnRegistration: true
    });

    let challenge = challengeWebauthn.registration_challenge;
    if(!challenge) throw new Error("No challenge received");

    return challenge;
}

async function getNewTotpChallenge(workers: AppWorkers, username: string): Promise<TotpSecretType> {
    const hostname = window.location.hostname;
    const response = await workers.connection.generateNewTotp({hostname, username}) as TotpSecretType;
    return response;
}

async function addMethod(workers: AppWorkers, username: string, publicKey: string, challenge: any, resetMethods: boolean) {
    // NB : Pour que l'enregistrement avec iOS fonctionne bien, il faut que la
    //      thread de l'evenement soit la meme que celle qui declenche
    //      navigator.credentials.create({publicKey}) sous repondreRegistrationChallenge
    if(challenge.publicKey) challenge = challenge.publicKey
    const reponse = await respondRegistrationChallenge(username, challenge);

    const hostname = window.location.hostname

    const params = {
        reponseChallenge: reponse,
        fingerprintPk: publicKey,
        hostname,
    } as any;

    if(resetMethods) {
        params.reset_cles = true
    }

    const result = await workers.connection.respondChallengeRegistrationWebauthn(params);
    if(result.ok !== true) {
        const error = new Error("Error, adding of security device refused (server)")
        // @ts-ignore
        error.response = result
        throw error
    }
}

async function respondRegistrationChallenge(username: string, challengeWebauthn: any) {
    // Parse options, remplacer base64 par buffer
    const challenge = multiencoding.decodeBase64Url(challengeWebauthn.challenge);
    const userId = multiencoding.decodeBase64Url(challengeWebauthn.user.id);
  
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
    const newCredential = await navigator.credentials.create({publicKey}) as any;
  
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

async function registerTotpCode(workers: AppWorkers, code: string, correlation: string) {
    const hostname = window.location.hostname;
    const command = {code, correlation, hostname};
    const response = await workers.connection.registerNewTotp(command);
    console.debug("Generate new TOTP response", response);
    if(!response.ok) throw new Error(`Error registering the new TOTP code: ${response.err}`);
}
