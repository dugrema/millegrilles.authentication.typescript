import {Dispatch, useState, useMemo, useCallback, useEffect} from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

import { multiencoding, certificates, messageStruct } from 'millegrilles.cryptography';

import LanguageIcon from './resources/language-svgrepo-com.svg';
import VersionInfo from './VersionInfo';
import useConnectionStore from './connectionStore';
import useAuthenticationStore from './authenticationStore';
import useWorkers, { AppWorkers } from './workers/workers';
import { clearCertificate, getUser, getUsersList, receiveCertificate, updateUser, UserCertificateRequest } from './idb/userStoreIdb';
import { AuthenticationChallengePublicKeyType, AuthenticationChallengeType } from './workers/connection.worker';
import { prepareAuthentication, PrepareAuthenticationResult, signAuthenticationRequest } from './webauthn';
import RecoveryScreen from './RecoveryScreen';
import ActionButton from './ActionButton';

function Login() {

    let { t } = useTranslation();
    let workers = useWorkers();

    let setUsernameStore = useConnectionStore(state=>state.setUsername);
    let setMustManuallyAuthenticate = useConnectionStore((state) => state.setMustManuallyAuthenticate);
    let setConnectionAuthenticated = useConnectionStore((state) => state.setConnectionAuthenticated);
    let setConnectionInsecure = useConnectionStore((state) => state.setConnectionInsecure);

    // Store that persists values in local storage
    let usernamePersist = useAuthenticationStore( state => state.username );
    let setUsernamePersist = useAuthenticationStore( state => state.setUsername );
    let sessionDurationPersist = useAuthenticationStore( state => state.sessionDuration );
    let setSessionDurationPersist = useAuthenticationStore( state => state.setSessionDuration );

    // Initialize values from persistent storage
    let [username, setUsername] = useState(usernamePersist);
    let [sessionDuration, setSessionDuration] = useState(sessionDurationPersist);

    let [recoveryScreen, setRecoveryScreen] = useState(false);
    let [error, setError] = useState('');
    let [mainOpacity, setMainOpacity] = useState('opacity-100');
    let [register, setRegister] = useState(false);
    let [webauthnChallenge, setWebauthnChallenge] = useState(null as PrepareAuthenticationResult | null);
    let [webauthnReady, setWebauthnReady] = useState(false);
    let [notAvailable, setNotAvailable] = useState(false);
    let [unknownUser, setUnknownUser] = useState(false);

    let handleLogin = useCallback(async ()=>{
        if(!workers) {
            setError('There is an error with the connection');
            return;
        }

        if(!username) {
            setError('Username cannot be empty');
            return;
        }

        if(notAvailable) {
            // There are no authentication methods availble for this browser.
            setRecoveryScreen(true);
            return;
        }

        // Handle auto-login redirect after a session timeout or access via bookmarks
        let url = new URL(window.location.href);
        let returnTo = url.searchParams.get('returnTo');
        // console.debug("URL: %O, returnTo: %O", url, returnTo);

        if(webauthnChallenge) {
            try {
                // Immediately sign the challenge - allows for 1-pass on iOS
                await authenticateHttpSession(workers, username, webauthnChallenge.demandeCertificat, webauthnChallenge.publicKey, sessionDuration)
                if(returnTo) {
                    url.pathname = returnTo;
                    url.searchParams.delete("returnTo");
                    window.location.replace(url.href);
                    return;
                }

                setUsernameStore(username);
                setMustManuallyAuthenticate(false);
                setConnectionAuthenticated(true);

                // Persist information for next time the screen is loaded
                setUsernamePersist(username);
                setSessionDurationPersist(sessionDuration);
            } catch(err) {
                console.error("Error logging in ", err);
                setRecoveryScreen(true);
            }
        }

        // Normal login process when the webauthn challenge is not provided up front.
        performLogin(workers, username, sessionDuration)
            .then(async result=>{
                // Set the username for the overall application
                if(result.register) {
                    setUsernameStore(username);
                    setRegister(true);
                } else if(result.authenticated) {
                    setUsernameStore(username);
                    setMustManuallyAuthenticate(false);

                    // Connect the worker
                    let authResult = await workers?.connection.authenticate(true);  // Reconnect flag
                    if(!authResult) throw new Error("Authentication error");
                    setConnectionAuthenticated(true);

                    // Todo - start transition to allow application list to preload.
                    setMainOpacity('opacity-0');  // Makes the login form fade out during the transition

                    // Persist information for next time the screen is loaded
                    setUsernamePersist(username);
                    setSessionDurationPersist(sessionDuration);
                } else if(result.webauthnChallenge) {
                    let user = await getUser(username);
                    let csr: string | null = null;
                    if(user?.request) {
                        // Use the CSR for the signature
                        csr = user?.request.pem;
                    }
                    let preparedChallenge = await prepareAuthentication(username, result.webauthnChallenge, csr, false);
                    setWebauthnChallenge(preparedChallenge);
                }
            })
            .catch(err=>{
                console.error("userLoginVerification error", err)
            });
        
    }, [workers, username, setMainOpacity, setUsernameStore, setRegister, setRecoveryScreen, webauthnChallenge, sessionDuration, setUsernamePersist, setSessionDurationPersist, setConnectionAuthenticated, setMustManuallyAuthenticate, notAvailable]);

    let prepareSignatureHandler = useCallback(async (webauthnChallenge: AuthenticationChallengeType)=>{
        // Check if the user exists locally and verify if certificate should be renewed.
        let csr: string | null = null;
        let user = await getUser(username);
        if(workers) {
            if(!user?.request) {
                if(user?.certificate) {
                    let wrapper = certificates.wrapperFromPems(user.certificate.certificate);
                    wrapper.populateExtensions();
                    let entry = await prepareRenewalIfDue(workers, wrapper);
                    if(entry) {
                        csr = entry.pem;
                    }
                } else {
                    // There is no certificate. Generate a CSR
                    let entry = await createCertificateRequest(workers, username);
                    csr = entry.pem;
                }
            } else if(user?.request) {
                // Use the CSR for the signature
                csr = user?.request.pem;
            }
        }

        let preparedChallenge = await prepareAuthentication(username, webauthnChallenge, csr, false);
        setWebauthnChallenge(preparedChallenge);
    }, [workers, username, setWebauthnChallenge]);

    // Pre-emptive loading of user authentication information
    useEffect(()=>{
        setNotAvailable(false);  // Reset

        let timeout = setTimeout(async () => {
            let userInfo = await userLoginVerification(username);
            console.debug("User info", userInfo);

            let webauthnChallenge = userInfo?.authentication_challenge;
            if(!userInfo) {
                // Unknown user
                setUnknownUser(true);
                setWebauthnReady(false);
                setWebauthnChallenge(null);
            } else if(userInfo.methodesDisponibles?.activation && userInfo.challenge_certificat) {
                // Deactivate webauthn, we just got permission to login without security
                setWebauthnReady(false);
                setWebauthnChallenge(null);
                setConnectionInsecure(true);  // Flag that indicates a connection that doesn't require security devices
            } else if(webauthnChallenge) {
                // Check if the user exists locally and verify if certificate should be renewed.
                await prepareSignatureHandler(webauthnChallenge);
                setWebauthnReady(true);
            } else {
                setWebauthnChallenge(null);
                setWebauthnReady(false);
                if(!userInfo?.challenge_certificat) {
                    // There are no recognized methods to log in from this browser.
                    setNotAvailable(true);
                }
            }
        }, 400);
        return () => clearTimeout(timeout);
    }, [workers, username, setWebauthnReady, setWebauthnChallenge, setConnectionInsecure, setNotAvailable, prepareSignatureHandler, setUnknownUser])

    // Timer to renew the webauthn challenge regularly to avoid stale requests if the user is
    // away from the screen.
    useEffect(()=>{
        if(!workers || !username || !webauthnChallenge) return;

        let timeout = setTimeout(async () => {
            let userInfo = await userLoginVerification(username);
            let webauthnChallenge = userInfo?.authentication_challenge;
            if(webauthnChallenge) {
                await prepareSignatureHandler(webauthnChallenge);
            }            
        }, 57_000);

        return () => clearTimeout(timeout);
    }, [workers, username, webauthnChallenge, setWebauthnChallenge, prepareSignatureHandler, setUnknownUser])

    let usernameOnChangeHandler = useCallback((e: React.FormEvent<HTMLInputElement>) => {
        setError('');
        setUsername(e.currentTarget.value);
        // Reset flags to deactivate the Next button
        setWebauthnChallenge(null);
        setUnknownUser(false);
    }, [setUsername, setError, setWebauthnChallenge, setUnknownUser]);

    let closeRegister = useCallback(()=>{
        setRegister(false);
    }, [setRegister]);

    let closeWebauthnScreen = useCallback(()=>{
        setWebauthnChallenge(null);
    }, [setWebauthnChallenge]);

    let closeRecoveryScreen = useCallback(()=>{
        setRecoveryScreen(false);
    }, [setRecoveryScreen]);

    let setSessionDurationHandler = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        let value = Number.parseInt(e.currentTarget.value);
        if(!isNaN(value)) setSessionDuration(value);
    }, [setSessionDuration]);

    // Determine which part of the login process to render
    let pageContent;
    if(register) {
        pageContent = (
            <UserRegistrationScreen username={username} back={closeRegister} sessionDuration={sessionDuration} />
        );
    } else if(recoveryScreen) {
        pageContent = (
            <RecoveryScreen username={username} back={closeRecoveryScreen} sessionDuration={sessionDuration} />
        );
    } else if(webauthnChallenge && !webauthnReady) {
        pageContent = (
            <WebauthnChallengeScreen username={username} back={closeWebauthnScreen} webauthnChallenge={webauthnChallenge} 
                sessionDuration={sessionDuration}/>
        );
    } else {
        pageContent = (
            <UserInputScreen username={username} usernameOnChange={usernameOnChangeHandler} handleLogin={handleLogin} 
                disabled={!webauthnChallenge && !unknownUser}
                duration={sessionDuration} setDuration={setSessionDurationHandler} />
        );
    }

    return (
        <div className={'transition-opacity duration-1000 grid grid-cols-1 justify-items-center ' + mainOpacity}>
            <h1 className='text-3xl font-bold text-slate-400'>{t('millegrilles')}</h1>

            {pageContent}

            <Message error={error} setError={setError} />
            <VersionInfo />
        </div>
    );
}

export default Login;

type UserInputScreenProps = {
    username: string,
    usernameOnChange(e: React.FormEvent<HTMLInputElement|HTMLFormElement>): void,
    handleLogin: ()=>Promise<void>,
    duration: number,
    setDuration(e: React.ChangeEvent<HTMLSelectElement>): void,
    disabled: boolean
};

function UserInputScreen(props: UserInputScreenProps) {
    return (
        <form>
            <div className='MessageBox grid grid-cols-3 min-w-80 max-w-lg border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 justify-items-end'>
                <UserSelection username={props.username} usernameOnChangeHandler={props.usernameOnChange} />
                <LanguageSelectbox />
                <DurationSelectbox duration={props.duration} setDuration={props.setDuration} />
                
                <div className='grid grid-cols-1 min-w-full col-span-3 justify-items-center mt-10'>
                    <Buttons handleLogin={props.handleLogin} disabled={props.disabled} />
                </div>
            </div>
        </form>
    );
}

type ButtonsProps = {
    handleLogin: ()=>Promise<void>,
    disabled: boolean,
};

function Buttons(props: ButtonsProps) {
    let { t } = useTranslation();
    let connectionReady = useConnectionStore((state) => state.connectionReady);

    let notReady = useMemo(()=>{
        if(connectionReady) return ''
        else return 'Currently offline';
    }, [connectionReady])

    return (
        <>
            <ActionButton onClick={props.handleLogin} disabled={props.disabled || !connectionReady} mainButton={true}>
                {t('buttons.next')}
            </ActionButton>
        </>
    )
}

type UserRegistrationScreenProps = {
    username: string,
    sessionDuration: number,
    back(e: any): void,
}

function UserRegistrationScreen(props: UserRegistrationScreenProps) {

    let { t } = useTranslation();
    let workers = useWorkers();
    let setMustManuallyAuthenticate = useConnectionStore((state) => state.setMustManuallyAuthenticate);
    let setConnectionAuthenticated = useConnectionStore((state) => state.setConnectionAuthenticated);
    let connectionReady = useConnectionStore((state) => state.connectionReady);

    // Store that persists values in local storage
    let setUsernamePersist = useAuthenticationStore( state => state.setUsername );
    let setSessionDurationPersist = useAuthenticationStore( state => state.setSessionDuration );
    
    let username = props.username;
    let sessionDuration = props.sessionDuration;

    let handleRegistration = useCallback((e: React.FormEvent<HTMLInputElement|HTMLFormElement>)=>{
        e.preventDefault();
        e.stopPropagation();
        if(!workers) throw Error("Workers not initialized");
        registerUser(workers, username, sessionDuration)
            .then(async response =>{
                if(response.authenticated) {
                    setMustManuallyAuthenticate(false);
                    setConnectionAuthenticated(true);

                    // Persist information for next time the screen is loaded
                    setUsernamePersist(username);
                    setSessionDurationPersist(sessionDuration);
                } else {
                    throw new Error("Registration / authentication failed");
                }
            })
            .catch(err=>{
                console.error("Error registering user", err);
            })
    }, [workers, username, sessionDuration, setConnectionAuthenticated, setMustManuallyAuthenticate, setUsernamePersist, setSessionDurationPersist]);

    return (
        <form onSubmit={handleRegistration}>
            <div className='MessageBox grid grid-cols-3 min-w-80 max-w-lg border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 justify-items-end'>

                <p className='col-span-3 text-left min-w-full'>{t('screens.registration.instructions1', {username})}</p>

                <div className='flex min-w-full col-span-3 justify-center mt-10'>
                    <input type='submit' value={t('buttons.register')} disabled={!connectionReady} 
                        className='btn bg-indigo-800 hover:bg-indigo-600 active:bg-indigo-500' />
                    <button onClick={props.back}
                        className='btn bg-slate-700 hover:bg-slate-600 active:bg-slate-500'>
                            {t('buttons.cancel')}
                    </button>
                </div>

            </div>
        </form>
    );
}

type WebauthnChallengeScreenProps = {
    username: string,
    back(e: any): void,
    webauthnChallenge: PrepareAuthenticationResult,
    sessionDuration: number,
}

function WebauthnChallengeScreen(props: WebauthnChallengeScreenProps) {

    let { t } = useTranslation();

    let username = props.username;
    let webauthnChallenge = props.webauthnChallenge;
    let sessionDuration = props.sessionDuration;  // Todo propagate session duration

    let workers = useWorkers();

    let setMustManuallyAuthenticate = useConnectionStore((state) => state.setMustManuallyAuthenticate);
    let setConnectionAuthenticated = useConnectionStore((state) => state.setConnectionAuthenticated);

    // Store that persists values in local storage
    let setUsernamePersist = useAuthenticationStore( state => state.setUsername );
    let setSessionDurationPersist = useAuthenticationStore( state => state.setSessionDuration );
    
    let loginHandler = useCallback(()=>{
        if(!workers) throw new Error("Workers not initialized");
        authenticateHttpSession(workers, username, webauthnChallenge.demandeCertificat, webauthnChallenge.publicKey, sessionDuration)
            .then(()=>{
                setConnectionAuthenticated(true);
                setMustManuallyAuthenticate(false);

                setUsernamePersist(username);
                setSessionDurationPersist(sessionDuration);
            })
            .catch(err=>console.error("Error logging in ", err));
    }, [workers, username, webauthnChallenge, sessionDuration, setUsernamePersist, setSessionDurationPersist, setConnectionAuthenticated, setMustManuallyAuthenticate]);

    return (
        <div className='MessageBox grid grid-cols-3 min-w-80 max-w-lg border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 justify-items-end'>

            <p className='col-span-3 text-left'>
                The user account {props.username} is protected by security devices. 
                Click on the Next button and follow the steps on the screen to log in.
            </p>

            <div className='flex min-w-full col-span-3 justify-center mt-10'>
                <button onClick={loginHandler} disabled={!webauthnChallenge}
                    className='btn bg-indigo-800 hover:bg-indigo-600 active:bg-indigo-500'>
                        {t('buttons.next')}
                </button>
                <button onClick={props.back} 
                    className='btn bg-slate-700 hover:bg-slate-600 active:bg-slate-500' >
                        {t('buttons.cancel')}
                </button>
            </div>

        </div>
    )
}

type UserSelectionProps = {
    username: string,
    usernameOnChangeHandler: any
};

function UserSelection(props: UserSelectionProps) {
    let { t } = useTranslation();

    let [users, setUsers] = useState<Array<string>|null>(null);

    useEffect(()=>{
        getUsersList()
            .then(users=>setUsers(users))
            .catch(err=>console.error("Error loading list of users ", err));
    }, [setUsers])

    // Note : the input field 'foilautocomplete' is used to prevent password managers from auto-filling the username.

    return (
        <>
            <label htmlFor='username' className='pr-4'>{t('labels.username')}</label>
            <input type="text" className='hidden' name='foilautocomplete' />
            <input 
                id='username' type='text' list='usernames' autoComplete='off'
                className='min-w-full col-span-2 bg-slate-700 text-slate-300 hover:bg-slate-500 hover:ring-offset-1 hover:ring-1 focus:bg-indigo-700' 
                value={props.username} onChange={props.usernameOnChangeHandler}
                />
            <datalist id='usernames'>
                {users?.map(item=>{
                    return <option key={item}>{item}</option>
                })}
            </datalist>
        </>
    )
}

type DurationSelectBox = {
    duration: number,
    setDuration(e: React.ChangeEvent<HTMLSelectElement>): void,
}

function DurationSelectbox(props: DurationSelectBox) {
    let { t } = useTranslation();
    return (
        <>
            <label htmlFor='duration' className='pr-4 mt-2'>{t('labels.sessionDuration')}</label>
            <select id='duration' onChange={props.setDuration} value={props.duration}
                className='bg-slate-700 text-slate-300 rounded min-w-full col-span-2 mt-2 hover:bg-slate-500 hover:ring-offset-1 hover:ring-1 focus:bg-indigo-700'>
                <option value='3600'>{t('labels.1hour')}</option>
                <option value='86400'>{t('labels.1day')}</option>
                <option value='604800'>{t('labels.1week')}</option>
                <option value='2678400'>{t('labels.1month')}</option>
            </select>
        </>
    )
}

export function LanguageSelectbox() {

    let { t, i18n } = useTranslation();
    
    let [language, setLanguage] = useState(i18n.language);

    let languageChangeHandler = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        let newLanguage = e.currentTarget.value;
        i18n.changeLanguage(newLanguage);
        setLanguage(newLanguage);
    }, [i18n, setLanguage]);

    let shortLanguage = useMemo(()=>{
        return language.split('-')[0];
    }, [language]);

    return (
        <>
            <label htmlFor='language' className='pr-4 mt-2'>
                <img src={LanguageIcon} className='w-7 inline invert' alt='Language icon' />
                {t('labels.language')}
            </label>
            <select id='language' 
                value={shortLanguage} onChange={languageChangeHandler}
                className='bg-slate-700 text-slate-300 rounded min-w-full col-span-2 mt-2 hover:bg-slate-500 hover:ring-offset-1 hover:ring-1 focus:bg-indigo-700'>
                <option value='en'>{t('language.english')}</option>
                <option value='fr'>{t('language.french')}</option>
            </select>
        </>
    )
}

type MessageProps = {
    error: string,
    setError: Dispatch<string>,
};

function Message(props: MessageProps) {

    const opacity = useMemo(()=>{
        if(!props.error) return ' invisible'
        return ' visible'
    }, [props.error]);

    return (
        <div className={'MessageBox h-32 min-w-80 max-w-lg border-4 border-slate-500 shadow-xl rounded-xl p-8 bg-slate-900 text-slate-300 mt-5 ' + opacity}>
            <p>{props.error}</p>
        </div>
    );
}

type UserLoginVerificationResult = {
    authentication_challenge?: AuthenticationChallengeType,
    challenge_certificat?: string,
    methodesDisponibles?: {activation?: boolean, certificat?: boolean},
    /** Newly activated certificate */
    certificat?: Array<string>,
};

export async function userLoginVerification(username: string): Promise<UserLoginVerificationResult | null> {
    // Check if the username exists or is new
    let userIdb = await getUser(username);
    // Load current public key to get activation flags (logging in without security devices)
    let currentPublicKey = userIdb?.certificate?.publicKeyString;
    // Load future public key (existing request) to get a newly activated certificate
    let newPublicKey = userIdb?.request?.publicKeyString;
    const hostname = window.location.hostname
    let data = {
        nomUsager: username, 
        hostname, 
        fingerprintPkCourant: currentPublicKey,
        fingerprintPkNouveau: newPublicKey,
    };
    let response = await axios({method: 'POST', url: '/auth/get_usager', data, timeout: 20_000 });
    if(response.status !== 200) {
        throw new Error(`Error during user verification (status: ${response.status})`);
    }
    if(response.data.contenu === 'null') {
        // User is unknown
        return null;
    } else {
        // User is known
        let content = await JSON.parse(response.data.contenu) as UserLoginVerificationResult;
        if(content.certificat && userIdb?.request) {
            let certificate = content.certificat;
            await receiveCertificate(username, certificate);

            // Do a new request to check that the back-end will accept activation with this certificate
            let certificateRequest = userIdb.request;
            data.fingerprintPkNouveau = undefined;
            data.fingerprintPkCourant = certificateRequest.publicKeyString;
            response = await axios({method: 'POST', url: '/auth/get_usager', data, timeout: 20_000 });
            content = await JSON.parse(response.data.contenu) as UserLoginVerificationResult;
        }
        return content;
    }
}

export async function createCertificateRequest(workers: AppWorkers, username: string, userId?: string): Promise<UserCertificateRequest> {
    let request = await workers?.connection.createCertificateRequest(username, userId);

    // Save the new CSR and private key in IDB.
    let publicKeyString = multiencoding.encodeHex(request.publicKey);

    let requestEntry = {
        pem: request.pem, 
        publicKey: request.publicKey, 
        privateKey: request.privateKey, 
        publicKeyString, 
        privateKeyPem: request.privateKeyPem
    };

    await updateUser({username, request: requestEntry});

    return requestEntry
}

async function registerUser(workers: AppWorkers, username: string, sessionDuration: number) {
    // Get userId if available
    let userId: string | undefined = undefined;
    let certificateRequest = await createCertificateRequest(workers, username, userId);

    // Register the user account
    let response = await workers.connection.registerAccount(username, certificateRequest.pem);

    if(response.ok !== true || !response.certificat) {
        throw new Error("Registration error");
    }

    // Get the newly generated certificate chain. The last one is the CA, remove it from the chain.
    let certificate = response.certificat;
    await receiveCertificate(username, certificate);

    // Activate the server session
    await performLogin(workers, username, sessionDuration);
    
    // Authenticate the connection worker
    return await authenticateConnectionWorker(workers, username, true);
}

export async function prepareRenewalIfDue(workers: AppWorkers, certificate: certificates.CertificateWrapper): Promise<UserCertificateRequest | null> {
    let expiration = certificate.certificate.notAfter;
    let now = new Date();

    let username = certificate.extensions?.commonName;
    let userId = certificate.extensions?.userId;

    if(!username || !userId) throw new Error("Invalid certificate, no commonName or userId");

    if(now > expiration) {
        // The certificate is expired. Remove it and generate new request.
        await clearCertificate(username);
        let entry = await createCertificateRequest(workers, username, userId);
        return entry;
    } else {
        // Check if the certificate is about to expire (>2/3 duration)
        let notBefore = certificate.certificate.notBefore;
        let totalDuration = expiration.getTime() - notBefore.getTime();
        let canRenewTs = Math.floor(totalDuration * 2/3 + notBefore.getTime());
        let canRenew = new Date(canRenewTs);

        if(now > canRenew) {
            // Generate a new certificate request
            let userId: string | undefined = undefined;  // TODO : get userId
            let entry = await createCertificateRequest(workers, username, userId);
            return entry;
        }
    }

    return null;
}

type PerformLoginResult = {
    register?: boolean,
    mustReconnectWorker?: boolean,
    mustManuallyAuthenticate?: boolean,
    authenticated?: boolean,
    userId?: string,
    webauthnChallenge?: AuthenticationChallengeType,
}

export async function performLogin(workers: AppWorkers, username: string, sessionDuration: number): Promise<PerformLoginResult> {
    let userDbInfo = await getUser(username)

    // let currentPublicKey: string | undefined;
    let newPublicKey: string | undefined;
    if(userDbInfo) {
        // The user is locally known. Extract public keys.
        let requestInfo = userDbInfo.request;
        newPublicKey = requestInfo?.publicKeyString;

        // Prepare information to generate challenges depending on server state.
        let certificateInfo = userDbInfo.certificate;
        // currentPublicKey = certificateInfo?.publicKeyString;
        
        if(!newPublicKey && certificateInfo?.certificate) {
            // We have no pending certificate request. Check if the current certificate is expired (or about to).
            let wrapper = new certificates.CertificateWrapper(certificateInfo.certificate);
            wrapper.populateExtensions();
            await prepareRenewalIfDue(workers, wrapper);
        }
    }

    let loginInfo = await userLoginVerification(username);
    if(loginInfo) {
        // The user exists
        if(userDbInfo?.certificate && loginInfo.challenge_certificat) {
            // We got a challenge to authenticate with the certificate.
            await workers.connection.prepareMessageFactory(userDbInfo.certificate.privateKey, userDbInfo.certificate.certificate);
            let authenticationResponse = await certificateAuthentication(workers, loginInfo.challenge_certificat, sessionDuration);
            return {authenticated: authenticationResponse.auth, userId: authenticationResponse.userId};
        } else {
            // Determine if we can authenticate with a security device (webauth).
            return { webauthnChallenge: loginInfo.authentication_challenge }
        }
    } else {
        // User does not exist. Allow registration of the unassigned username.
        return {register: true};
    }
}

type AuthenticationResponseType = {
    auth?: boolean,
    userId?: string,
    certificat?: Array<string>,
}

async function certificateAuthentication(workers: AppWorkers, challenge: string, sessionDuration?: number): Promise<AuthenticationResponseType> {
    let data = {certificate_challenge: challenge, activation: true, dureeSession: sessionDuration};
    // Sign as a command
    let command = await workers.connection.signAuthentication(data);
    let authenticationResult = await axios.post('/auth/authentifier_usager', command);
    let responseMessage = authenticationResult.data as messageStruct.MilleGrillesMessage;
    let authenticationResponse = JSON.parse(responseMessage.contenu) as AuthenticationResponseType;
    return authenticationResponse
}

/**
 * Authenticate the HTTP session to get a session cookie. This is pre-requisite before using
 * the connection worker. The same session cookie will be used with the socket-io HTTP session.
 * @param workers 
 * @param username 
 * @param demandeCertificat 
 * @param publicKey 
 * @param sessionDuration 
 * @returns 
 */
async function authenticateHttpSession(workers: AppWorkers, username: string, demandeCertificat: any, 
    publicKey: AuthenticationChallengePublicKeyType, sessionDuration: number): Promise<AuthenticationResponseType> 
{
    // N.B. La methode doit etre appelee par la meme thread que l'event pour supporter
    //      TouchID sur iOS.
    const data = await signAuthenticationRequest(username, demandeCertificat, publicKey, sessionDuration);

    const resultatAuthentification = await axios.post('/auth/authentifier_usager', data)
    const authResponse = resultatAuthentification.data
    const responseContent = JSON.parse(authResponse.contenu) as AuthenticationResponseType;

    if(responseContent.auth && responseContent.userId) {

        if(responseContent.certificat) {
            // Save the new certificate over the old one
            // Get the newly generated certificate chain. The last one is the CA, remove it from the chain.
            let certificate = responseContent.certificat;
            await receiveCertificate(username, certificate);
        }

        // Activate the server session
        await performLogin(workers, username, sessionDuration);
        
        // Authenticate the connection worker
        return await authenticateConnectionWorker(workers, username, true);
    } else {
        throw new Error("WebAuthn.authentifier Erreur authentification")
    }
}

/**
 * Connect using socket-io.
 * @param workers 
 * @param username 
 * @param userSessionActive 
 * @returns 
 */
export async function authenticateConnectionWorker(workers: AppWorkers, username: string, 
    userSessionActive: boolean): Promise<PerformLoginResult> 
{
    if(!workers) return {};  // Waiting for a connection

    if(!userSessionActive || !username) {
        // User session is not active. We need to manually authenticate.
        // setMustManuallyAuthenticate(true);
        return { mustManuallyAuthenticate: true };
    }

    // There is a user session (cookie) and a username in the server session. 
    // Check if we have a valid signing key/certificate for this user.
    let userDbInfo = await getUser(username)
    if(!userDbInfo) {
        // No local information (certificate). 
        return { mustManuallyAuthenticate: true };
    }

    let certificateInfo = userDbInfo.certificate;
    if(!certificateInfo) {
        // No certificate. The user must authenticate manually.
        return { mustManuallyAuthenticate: true };
    }

    let wrapper = new certificates.CertificateWrapper(certificateInfo.certificate);

    // Check if the certificate is expired
    let expiration = wrapper.certificate.notAfter;
    let now = new Date();
    if(now > expiration) {
        // The certificate is expired. Remove it, generate a new CSR and force manual authentication.
        await clearCertificate(username);
        let userId: string | undefined = undefined;  // TODO : get userId
        await createCertificateRequest(workers, username, userId);
        return { mustManuallyAuthenticate: true };
    }

    // Initialize the message factory with the user's information.
    let { privateKey, certificate } = certificateInfo;
    await workers.connection.prepareMessageFactory(privateKey, certificate);

    // Authenticate the connection
    if(!await workers.connection.authenticate(true)) throw new Error('Authentication failed (api mapping)');

    return { authenticated: true };
}
