import {Dispatch, useState, useMemo, useCallback, useEffect} from 'react';
import axios from 'axios';
import LanguageIcon from './resources/language-svgrepo-com.svg';
import VersionInfo from './VersionInfo';
import useConnectionStore from './connectionStore';
import useAuthenticationStore from './authenticationStore';
import useWorkers, { AppWorkers } from './workers/workers';
import { getUser, getUsersList, updateUser, UserCertificateRequest } from './idb/userStoreIdb';
import { multiencoding, certificates, messageStruct, digest } from 'millegrilles.cryptography';
import stringify from 'json-stable-stringify';
import { AuthenticationChallengePublicKeyType, AuthenticationChallengeType } from './workers/connection.worker';

const CLASSNAME_BUTTON_PRIMARY = `
    transition ease-in-out 
    min-w-40 
    rounded 
    bg-slate-700 text-slate-300 
    font-bold
    active:bg-indigo-700
    disabled:bg-slate-900 disabled:text-slate-600 disabled:ring-offset-0 disabled:ring-0
    hover:bg-slate-500 hover:ring-offset-1 hover:ring-1
    p-1 m-1
`;

function Login() {

    let workers = useWorkers();
    let setUsernameStore = useConnectionStore(state=>state.setUsername);
    let setMustManuallyAuthenticate = useConnectionStore((state) => state.setMustManuallyAuthenticate);
    let setConnectionAuthenticated = useConnectionStore((state) => state.setConnectionAuthenticated);

    // Store that persists values in local storage
    let usernamePersist = useAuthenticationStore( state => state.username );
    let setUsernamePersist = useAuthenticationStore( state => state.setUsername );
    let sessionDurationPersist = useAuthenticationStore( state => state.sessionDuration );
    let setSessionDurationPersist = useAuthenticationStore( state => state.setSessionDuration );

    // Initialize values from persistent storage
    let [username, setUsername] = useState(usernamePersist);
    let [sessionDuration, setSessionDuration] = useState(sessionDurationPersist);

    let [error, setError] = useState('');
    let [mainOpacity, setMainOpacity] = useState('opacity-100');
    let [register, setRegister] = useState(false);
    let [webauthnChallenge, setWebauthnChallenge] = useState<PrepareAuthenticationResult>();
    let [webauthnReady, setWebauthnReady] = useState(false);

    let handleLogin = useCallback((e: React.FormEvent<HTMLInputElement|HTMLFormElement> | null)=>{
        e?.preventDefault();
        e?.stopPropagation();

        if(!workers) {
            setError('There is an error with the connection');
            return;
        }

        if(!username) {
            setError('Username cannot be empty');
            return;
        }

        if(webauthnChallenge) {
            // Immediately sign the challenge - allows for 1-pass on iOS
            authenticate(workers, username, webauthnChallenge.demandeCertificat, webauthnChallenge.publicKey, sessionDuration)
                .then(async () => {
                    setUsernameStore(username);
                    setMustManuallyAuthenticate(false);
                    setConnectionAuthenticated(true);

                    // Persist information for next time the screen is loaded
                    setUsernamePersist(username);
                    setSessionDurationPersist(sessionDuration);
                })
                .catch(err=>console.error("Error logging in ", err));
            return;
        }

        // Normal login process when the webauthn challenge is not provided up front.
        performLogin(workers, username, sessionDuration)
            .then(async result=>{
                // Set the username for the overall application
                setUsernameStore(username);
                if(result.register) {
                    setRegister(true);
                } else if(result.authenticated) {
                    setMustManuallyAuthenticate(false);

                    // Connect the worker
                    let authResult = await workers?.connection.authenticate();
                    console.debug("Auth result ", authResult);
                    if(!authResult) throw new Error("Authentication error");
                    setConnectionAuthenticated(true);

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
                console.debug("userLoginVerification error", err)
            });
        
    }, [workers, username, setMainOpacity, setUsernameStore, setRegister, webauthnChallenge, sessionDuration, setUsernamePersist, setSessionDurationPersist]);

    // Pre-emptive loading of user authentication information
    useEffect(()=>{
        let timeout = setTimeout(async () => {
            let userInfo = await userLoginVerification(username);
            console.debug("Loaded user info ", userInfo);
            let webauthnChallenge = userInfo?.authentication_challenge;
            if(webauthnChallenge) {
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
                                console.debug("New CSR generated for renewal");
                                csr = entry.pem;
                            }
                        } else {
                            // There is no certificate. Generate a CSR
                            console.debug("Generate CSR for entry without certificate");
                            let entry = await createCertificateRequest(workers, username);
                            csr = entry.pem;
                        }
                    } else if(user?.request) {
                        // Use the CSR for the signature
                        console.debug("Use existing CSR");
                        csr = user?.request.pem;
                    }
                }

                let preparedChallenge = await prepareAuthentication(username, webauthnChallenge, csr, false);
                setWebauthnReady(true);
                setWebauthnChallenge(preparedChallenge);
            } else {
                setWebauthnChallenge(undefined);
                setWebauthnReady(false);
            }
        }, 400);
        return () => clearTimeout(timeout);
    }, [workers, username, setWebauthnReady, setWebauthnChallenge])

    let usernameOnChangeHandler = useCallback((e: React.FormEvent<HTMLInputElement>) => {
        setError('');
        setUsername(e.currentTarget.value);
    }, [setUsername, setError]);

    let closeRegister = useCallback(()=>{
        setRegister(false);
    }, [setRegister]);

    let closeWebauthnScreen = useCallback(()=>{
        setWebauthnChallenge(undefined);
    }, [setWebauthnChallenge]);

    let setSessionDurationHandler = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        let value = Number.parseInt(e.currentTarget.value);
        console.debug("Set session duration : %O : %O", e.currentTarget.value, value);
        if(!isNaN(value)) setSessionDuration(value);
    }, [setSessionDuration]);

    // Determine which part of the login process to render
    let pageContent;
    if(register) {
        pageContent = (
            <UserRegistrationScreen username={username} back={closeRegister} sessionDuration={sessionDuration} />
        );
    } else if(webauthnChallenge && !webauthnReady) {
        pageContent = (
            <WebauthnChallengeScreen username={username} back={closeWebauthnScreen} webauthnChallenge={webauthnChallenge} 
                sessionDuration={sessionDuration}/>
        );
    } else {
        pageContent = (
            <UserInputScreen username={username} usernameOnChange={usernameOnChangeHandler} handleLogin={handleLogin} 
                duration={sessionDuration} setDuration={setSessionDurationHandler} />
        );
    }

    return (
        <div className={'transition-opacity duration-1000 grid grid-cols-1 justify-items-center ' + mainOpacity}>
            <h1 className='text-3xl font-bold text-slate-400'>MilleGrilles</h1>

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
    handleLogin(e: React.FormEvent<HTMLInputElement|HTMLFormElement>): void,
    duration: number,
    setDuration(e: React.ChangeEvent<HTMLSelectElement>): void,
};

function UserInputScreen(props: UserInputScreenProps) {
    return (
        <form>
            <div className='MessageBox grid grid-cols-3 min-w-80 max-w-lg border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 justify-items-end'>
                <UserSelection username={props.username} usernameOnChangeHandler={props.usernameOnChange} />
                <LanguageSelectbox />
                <DurationSelectbox duration={props.duration} setDuration={props.setDuration} />
                
                <div className='grid grid-cols-1 min-w-full col-span-3 justify-items-center mt-10'>
                    <Buttons handleLogin={props.handleLogin} />
                </div>
            </div>
        </form>
    );
}

type UserRegistrationScreenProps = {
    username: string,
    sessionDuration: number,
    back(e: any): void,
}

function UserRegistrationScreen(props: UserRegistrationScreenProps) {

    let workers = useWorkers();
    let setMustManuallyAuthenticate = useConnectionStore((state) => state.setMustManuallyAuthenticate);
    let setConnectionAuthenticated = useConnectionStore((state) => state.setConnectionAuthenticated);

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

                <p className='col-span-3 text-left'>The user account {username} is available. Click on the Register button to claim it.</p>

                <div className='flex min-w-full col-span-3 justify-center mt-10'>
                    <input type='submit' className={CLASSNAME_BUTTON_PRIMARY} value='Register'/>
                    <button className={CLASSNAME_BUTTON_PRIMARY} onClick={props.back}>Cancel</button>
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
        console.debug("Log in with ", webauthnChallenge);
        if(!workers) throw new Error("Workers not initialized");
        authenticate(workers, username, webauthnChallenge.demandeCertificat, webauthnChallenge.publicKey, sessionDuration)
            .then(()=>{
                setConnectionAuthenticated(true);
                setMustManuallyAuthenticate(false);

                setUsernamePersist(username);
                setSessionDurationPersist(sessionDuration);
            })
            .catch(err=>console.error("Error logging in ", err));
    }, [workers, username, webauthnChallenge, sessionDuration, setUsernamePersist, setSessionDurationPersist]);

    return (
        <div className='MessageBox grid grid-cols-3 min-w-80 max-w-lg border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 justify-items-end'>

            <p className='col-span-3 text-left'>
                The user account {props.username} is protected by security devices. 
                Click on the Next button and follow the steps on the screen to log in.
            </p>

            <div className='flex min-w-full col-span-3 justify-center mt-10'>
                <button onClick={loginHandler} className={CLASSNAME_BUTTON_PRIMARY}>Next</button>
                <button className={CLASSNAME_BUTTON_PRIMARY} onClick={props.back}>Cancel</button>
            </div>

        </div>
    )
}

type UserSelectionProps = {
    username: string,
    usernameOnChangeHandler: any
};

function UserSelection(props: UserSelectionProps) {

    let [users, setUsers] = useState<Array<string>|null>(null);

    useEffect(()=>{
        getUsersList()
            .then(users=>setUsers(users))
            .catch(err=>console.error("Error loading list of users ", err));
    }, [setUsers])

    // Note : the input field 'foilautocomplete' is used to prevent password managers from auto-filling the username.

    return (
        <>
            <label htmlFor='username' className='pr-4'>Username</label>
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
    return (
        <>
            <label htmlFor='duration' className='pr-4 mt-2'>Session duration</label>
            <select id='duration' onChange={props.setDuration} value={props.duration}
                className='bg-slate-700 text-slate-300 rounded min-w-full col-span-2 mt-2 hover:bg-slate-500 hover:ring-offset-1 hover:ring-1 focus:bg-indigo-700'>
                <option value='3600'>1 hour</option>
                <option value='86400'>1 day</option>
                <option value='604800'>1 week</option>
                <option value='2678400'>1 month</option>
            </select>
        </>
    )
}

export function LanguageSelectbox() {
    return (
        <>
            <label htmlFor='language' className='pr-4 mt-2'>
                <img src={LanguageIcon} className='w-7 inline invert' alt='Language icon' />
                Language
            </label>
            <select id='language' className='bg-slate-700 text-slate-300 rounded min-w-full col-span-2 mt-2 hover:bg-slate-500 hover:ring-offset-1 hover:ring-1 focus:bg-indigo-700'>
                <option>English</option>
                <option>Français</option>
            </select>
        </>
    )
}

type ButtonsProps = {
    handleLogin: any
};

function Buttons(props: ButtonsProps) {
    return (
        <>
            <button className={CLASSNAME_BUTTON_PRIMARY} onClick={props.handleLogin}>Next</button>
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

type CredentialsType = {
    id: string,
    type: string,
};

// type AuthenticationChallengePublicKeyType = {
//     allowCredentials?: Array<CredentialsType>,
//     challenge: string,
//     rpId?: string,
//     timeout?: number,
//     userVerification?: 'string',
// };

// type AuthenticationChallengeType = {
//     publicKey?: AuthenticationChallengePublicKeyType,
// };

type UserLoginVerificationResult = {
    authentication_challenge?: AuthenticationChallengeType,
    challenge_certificat?: string,
    methodesDisponibles?: {activation?: boolean, certificat?: boolean}
};

async function userLoginVerification(username: string): Promise<UserLoginVerificationResult | null> {
    // Check if the username exists or is new
    // let userInformation = await workers.connection.getUserInformation(username);
    //console.debug("User information : ", userInformation);
    let userIdb = await getUser(username);
    let currentPublicKey = userIdb?.certificate?.publicKeyString;
    const hostname = window.location.hostname
    let data = {
        nomUsager: username, 
        hostname, 
        fingerprintPkCourant: currentPublicKey,
        // fingerprintPkNouveau, 
    };
    let response = await axios({method: 'POST', url: '/auth/get_usager', data, timeout: 20_000 });
    if(response.status !== 200) {
        throw new Error(`Error during user verification (status: ${response.status})`);
    }
    console.debug("Response: ", response);
    if(response.data.contenu === 'null') {
        // User is unknown
        return null;
    } else {
        // User is known
        let content = await JSON.parse(response.data.contenu) as UserLoginVerificationResult;
        console.debug("Response content ", content);
        return content;
    }
}

export async function createCertificateRequest(workers: AppWorkers, username: string, userId?: string): Promise<UserCertificateRequest> {
    let request = await workers?.connection.createCertificateRequest(username, userId);
    console.debug("Certificate request : ", request);

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
    console.debug("Register ", username)
    // Get userId if available
    let userId: string | undefined = undefined;
    let certificateRequest = await createCertificateRequest(workers, username, userId);

    // Register the user account
    let response = await workers.connection.registerAccount(username, certificateRequest.pem);
    console.debug("Response : ", response);

    if(response.ok !== true || !response.certificat) {
        throw new Error("Registration error");
    }

    // Get the newly generated certificate chain. The last one is the CA, remove it from the chain.
    let certificate = response.certificat;
    let ca = certificate.pop();

    let certificateEntry = {
        certificate,
        publicKey: certificateRequest.publicKey,
        privateKey: certificateRequest.privateKey,
        publicKeyString: certificateRequest.publicKeyString,
    };
    await updateUser({
        username, certificate: certificateEntry,
        request: undefined, // Remove previous request
        // legacy
        ca, certificat: certificate, clePriveePem: certificateRequest.privateKeyPem,
    });

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
        updateUser({
            username, certificate: undefined, 
            // Legacy
            certificat: undefined, clePriveePem: undefined, ca: undefined,
        });
        let entry = await createCertificateRequest(workers, username, userId);
        return entry;
    } else {
        // Check if the certificate is about to expire (>2/3 duration)
        let notBefore = certificate.certificate.notBefore;
        let totalDuration = expiration.getTime() - notBefore.getTime();
        let canRenewTs = Math.floor(totalDuration * 2/3 + notBefore.getTime());
        let canRenew = new Date(canRenewTs);
        console.debug("Can renew date : ", canRenew);

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

async function performLogin(workers: AppWorkers, username: string, sessionDuration: number): Promise<PerformLoginResult> {
    let userDbInfo = await getUser(username)
    console.debug("User DB info ", userDbInfo);

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
    console.debug("userLoginVerification OK, result: ", loginInfo);
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

export async function authenticateConnectionWorker(workers: AppWorkers, username: string, userSessionActive: boolean): Promise<PerformLoginResult> {
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

    // Check if the certificat is expired
    let expiration = wrapper.certificate.notAfter;
    let now = new Date();
    if(now > expiration) {
        // The certificate is expired. Remove it, generate a new CSR and force manual authentication.
        await updateUser({username, certificate: undefined});
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

export type PrepareAuthenticationResult = {
    publicKey: AuthenticationChallengePublicKeyType, 
    demandeCertificat: any, 
    challengeReference: string,
};

export async function prepareAuthentication(
    username: string, challengeWebauthn: AuthenticationChallengeType, csr: string | null, activationTierce: boolean
): Promise<PrepareAuthenticationResult> {
    console.debug("Preparer authentification avec : %O, CSR: %s", challengeWebauthn, csr);
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

    let demandeCertificat: {nomUsager: string, csr: string, date: number, activationTierce?: boolean} | null = null;
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
        console.debug("Hachage demande cert %O = %O, ajouter au challenge existant de : %O", hachageDemandeCert, demandeCertificat, publicKey.challenge)
        
        // Concatener le challenge recu (32 bytes) au hachage de la commande
        // Permet de signer la commande de demande de certificat avec webauthn
        const challengeMaj = new Uint8Array(64)
        challengeMaj.set(publicKey.challenge, 0)
        challengeMaj.set(hachageDemandeCert, 32)
        publicKey.challenge = challengeMaj

        console.debug("Challenge override pour demander signature certificat : %O", publicKey.challenge)
    } 

    const resultat = { publicKey, demandeCertificat, challengeReference }
    console.debug("Prep publicKey/demandeCertificat : %O", resultat)
    
    return resultat
}

async function authenticate(workers: AppWorkers, username: string, demandeCertificat: any, publicKey: any, sessionDuration: number): Promise<AuthenticationResponseType> {
    // N.B. La methode doit etre appelee par la meme thread que l'event pour supporter
    //      TouchID sur iOS.
    console.debug("Signer challenge : %O (opts: %O)", publicKey)

    const data = await signAuthenticationRequest(username, demandeCertificat, publicKey, sessionDuration);

    console.debug("Data a soumettre pour reponse webauthn : %O", data)
    const resultatAuthentification = await axios.post('/auth/authentifier_usager', data)
    console.debug("Resultat authentification : %O", resultatAuthentification)
    const authResponse = resultatAuthentification.data
    const responseContent = JSON.parse(authResponse.contenu) as AuthenticationResponseType;

    if(responseContent.auth && responseContent.userId) {

        if(responseContent.certificat) {
            // Save the new certificate over the old one
            // Get the newly generated certificate chain. The last one is the CA, remove it from the chain.
            let certificate = responseContent.certificat;
            let ca = certificate.pop();

            let userIdb = await getUser(username);
            let certificateRequest = userIdb?.request;
            if(!certificateRequest) {
                throw new Error("Error during certificate renewal, no active certificate available");
            }

            let certificateEntry = {
                certificate,
                publicKey: certificateRequest.publicKey,
                privateKey: certificateRequest.privateKey,
                publicKeyString: certificateRequest.publicKeyString,
            };
            await updateUser({
                username, certificate: certificateEntry,
                request: undefined, // Remove previous request
                // legacy
                ca, certificat: certificate, clePriveePem: certificateRequest.privateKeyPem,
            });
        }

        // Activate the server session
        await performLogin(workers, username, sessionDuration);
        
        // Authenticate the connection worker
        return await authenticateConnectionWorker(workers, username, true);
    } else {
        throw new Error("WebAuthn.authentifier Erreur authentification")
    }
}

type SignAuthenticationResult = {
    nomUsager: string, 
    demandeCertificat?: any, 
    dureeSession?: number,
    webauthn?: any,
};

export async function signAuthenticationRequest(username: string, demandeCertificat: string, publicKey: any, sessionDuration?: number): Promise<SignAuthenticationResult> {
    // const connexion = opts.connexion
    // N.B. La methode doit etre appelee par la meme thread que l'event pour supporter
    //      TouchID sur iOS.
    console.debug("Signer challenge pour %s (demandeCertificat %O, publicKey: %O)", username, demandeCertificat, publicKey)
   
    const publicKeyCredentialSignee = await navigator.credentials.get({publicKey}) as any
    console.debug("PublicKeyCredential signee : %O", publicKeyCredentialSignee)
    
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

    console.debug("Reponse serialisable : %O", reponseSerialisable)

    const data = {
        nomUsager: username, 
        demandeCertificat, 
        webauthn: reponseSerialisable, 
        challenge: publicKey.challenge
    } as SignAuthenticationResult;
    if(sessionDuration) data.dureeSession = sessionDuration;

    return data
}
