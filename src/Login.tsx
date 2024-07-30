import {Dispatch, useState, useMemo, useCallback, useEffect} from 'react';
import axios from 'axios';
import LanguageIcon from './resources/language-svgrepo-com.svg';
import VersionInfo from './VersionInfo';
import useConnectionStore from './connectionStore';
import useWorkers, { AppWorkers } from './workers/workers';
import { getUser, getUsersList, updateUser } from './idb/userStoreIdb';
import { multiencoding, certificates, messageStruct } from 'millegrilles.cryptography';

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

    console.debug("Login Page render");

    let workers = useWorkers();
    let usernameStore = useConnectionStore(state=>state.username);
    let setUsernameStore = useConnectionStore(state=>state.setUsername);
    let connectionReady = useConnectionStore((state) => state.connectionReady);
    let userSessionActive = useConnectionStore((state) => state.userSessionActive);
    let setMustManuallyAuthenticate = useConnectionStore((state) => state.setMustManuallyAuthenticate);
    let setConnectionAuthenticated = useConnectionStore((state) => state.setConnectionAuthenticated);

    let [username, setUsername] = useState('');
    let [error, setError] = useState('');
    let [mainOpacity, setMainOpacity] = useState('opacity-100');
    let [register, setRegister] = useState(false);

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

        performLogin(workers, username)
            .then(result=>{
                // Set the username for the overall application
                setUsernameStore(username);
                if(result.register) {
                    setRegister(true);
                } else if(result.authenticated) {
                    setMustManuallyAuthenticate(false);
                    setConnectionAuthenticated(true);
                }
            })
            .catch(err=>{
                console.debug("userLoginVerification error", err)
            });
    
        // console.debug("Login user %s", username);
        // setMainOpacity('opacity-0');
        // setTimeout(()=>{
        //     setUsernameStore(username);
        // }, 1000);
        
    }, [workers, username, setMainOpacity, setUsernameStore, setRegister]);

    useEffect(()=>{
        console.debug("Login workers %O, connectionReady: %O", workers, connectionReady);
        if(!workers || !connectionReady) return;

        authenticateConnectionWorker(workers, usernameStore, userSessionActive)
            .then(result=>{
                console.debug("Result of authenticateConnectionWorker : ", result);
                if(result.mustManuallyAuthenticate) {
                    setMustManuallyAuthenticate(true);
                    return;
                }

                if(result.authenticated) {
                    setMustManuallyAuthenticate(false);
                    setConnectionAuthenticated(true);
                }
            })
            .catch(err=>{
                console.error("Authentication error ", err);
            });
    }, [workers, usernameStore, userSessionActive, connectionReady, setMustManuallyAuthenticate, setConnectionAuthenticated]);

    let usernameOnChangeHandler = useCallback((e: React.FormEvent<HTMLInputElement>) => {
        setError('');
        setUsername(e.currentTarget.value);
    }, [setUsername, setError]);

    let closeRegister = useCallback(()=>{
        setRegister(false);
    }, [setRegister]);

    return (
        <div className={'transition-opacity duration-1000 grid grid-cols-1 justify-items-center ' + mainOpacity}>
            <h1 className='text-3xl font-bold text-slate-400'>MilleGrilles</h1>

            {register?
                <UserRegistrationScreen username={username} back={closeRegister} />
            :
                <UserInputScreen username={username} usernameOnChange={usernameOnChangeHandler} handleLogin={handleLogin} />
            }
            
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
};

function UserInputScreen(props: UserInputScreenProps) {
    return (
        <form>
            <div className='MessageBox grid grid-cols-3 min-w-80 max-w-lg border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 justify-items-end'>
                <UserSelection username={props.username} usernameOnChangeHandler={props.usernameOnChange} />
                <LanguageSelectbox />
                <DurationSelectbox />
                
                <div className='grid grid-cols-1 min-w-full col-span-3 justify-items-center mt-10'>
                    <Buttons handleLogin={props.handleLogin} />
                </div>
            </div>
        </form>
    );
}

type UserRegistrationScreenProps = {
    username: string,
    back(e: any): void,
}

function UserRegistrationScreen(props: UserRegistrationScreenProps) {

    let workers = useWorkers();
    let setMustManuallyAuthenticate = useConnectionStore((state) => state.setMustManuallyAuthenticate);
    //let setConnectionAuthenticated = useConnectionStore((state) => state.setConnectionAuthenticated);

    let username = props.username;

    let handleRegistration = useCallback((e: React.FormEvent<HTMLInputElement|HTMLFormElement>)=>{
        e.preventDefault();
        e.stopPropagation();
        if(!workers) throw Error("Workers not initialized");
        registerUser(workers, username)
            .then(async result =>{
                console.debug("User registered: ", result);
                throw new Error('todo - reconnect');
                setMustManuallyAuthenticate(false);
            })
            .catch(err=>{
                console.error("Error registering user", err);
            })
    }, [workers, username]);

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

function DurationSelectbox() {
    return (
        <>
            <label htmlFor='duration' className='pr-4 mt-2'>Session duration</label>
            <select id='duration' className='bg-slate-700 text-slate-300 rounded min-w-full col-span-2 mt-2 hover:bg-slate-500 hover:ring-offset-1 hover:ring-1 focus:bg-indigo-700'>
                <option>1 hour</option>
                <option>1 day</option>
                <option>1 week</option>
                <option>1 month</option>
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

type AuthenticationChallengeType = {
    publicKey?: {
        allowCredentials?: Array<CredentialsType>,
        challenge: string,
        rpId?: string,
        timeout?: number,
        userVerification?: 'string',
    },
};

type UserLoginVerificationResult = {
    authentication_challenge?: AuthenticationChallengeType,
    challenge_certificat?: string,
    methodesDisponibles?: {activation?: boolean, certificat?: boolean}
};

async function userLoginVerification(username: string, fingerprintPkCourant?: string, fingerprintPkNouveau?: string): Promise<UserLoginVerificationResult | null> {
    // Check if the username exists or is new
    // let userInformation = await workers.connection.getUserInformation(username);
    //console.debug("User information : ", userInformation);
    const hostname = window.location.hostname
    let data = {
        nomUsager: username, 
        hostname, 
        fingerprintPkCourant,
        fingerprintPkNouveau, 
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

// export async function chargerUsager(nomUsager, fingerprintPk, fingerprintCourant, opts) {
//     opts = opts || {}
//     const hostname = window.location.hostname
//     const data = {
//         nomUsager, hostname, 
//         ...opts, 
//         fingerprintPkNouveau: fingerprintPk, fingerprintPkCourant: fingerprintCourant
//     }
//     const reponse = await axios({method: 'POST', url: '/auth/get_usager', data, timeout: 20_000})
//     const reponseEnveloppe = reponse.data
//     const infoUsager = JSON.parse(reponseEnveloppe.contenu)
//     // console.debug("chargerUsager Reponse ", infoUsager)
//     const authentifie = infoUsager?infoUsager.auth:false

//     const infoUsagerDefault = infoUsager || {}

//     const certificat = infoUsagerDefault.certificat
//     if(certificat) {
//         // Mettre a jour le certificat
//         const usager = await usagerDao.getUsager(nomUsager)
//         const requete = usager.requete
//         if(requete) {
//             const { clePriveePem, fingerprintPk } = requete
//             // Extraire le certificat
//             const dataAdditionnel = {clePriveePem, fingerprintPk}
//             console.info("Mettre a jour le certificat de %s", nomUsager)
//             await sauvegarderCertificatPem(nomUsager, certificat, dataAdditionnel)
//         }
//     }

//     return {nomUsager, infoUsager, authentifie}
// }

async function registerUser(workers: AppWorkers, username: string) {
    console.debug("Register ", username)
    // Get userId if available
    let userId: string | undefined = undefined;
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

    // Register the user account
    let response = await workers.connection.registerAccount(username, request.pem);
    console.debug("Response : ", response);

    if(response.ok !== true || !response.certificat) {
        throw new Error("Registration error");
    }

    let certificate = response.certificat;
    let ca = certificate.pop();

    let certificateEntry = {
        certificate,
        publicKey: request.publicKey,
        privateKey: request.privateKey,
        publicKeyString,
    };
    await updateUser({
        username, certificate: certificateEntry,
        request: undefined, // Remove previous request
        // legacy
        ca, certificat: certificate, clePriveePem: request.privateKeyPem,
    });
}

type PerformLoginResult = {
    register?: boolean,
    mustReconnectWorker?: boolean,
    mustManuallyAuthenticate?: boolean,
    authenticated?: boolean,
    userId?: string,
}

async function performLogin(workers: AppWorkers, username: string): Promise<PerformLoginResult> {
    let userDbInfo = await getUser(username)
    console.debug("User DB info ", userDbInfo);

    let currentPublicKey: string | undefined;
    let newPublicKey: string | undefined;
    if(userDbInfo) {
        // The user is locally known. Extract public keys.
        let requestInfo = userDbInfo.request;
        newPublicKey = requestInfo?.publicKeyString;

        // Prepare information to generate challenges depending on server state.
        let certificateInfo = userDbInfo.certificate;
        currentPublicKey = certificateInfo?.publicKeyString;
        
        if(!newPublicKey && certificateInfo?.certificate) {
            // We have no pending certificate request. Check if the current certificate is expired (or about to).
            let wrapper = new certificates.CertificateWrapper(certificateInfo.certificate);
            let expiration = wrapper.certificate.notAfter;
            let now = new Date();
            if(now > expiration) {
                // The certificate is expired. Remove it and generate new request.
                throw new Error('todo - remove certificate, generate new CSR');
            }
            // Check if the certificate is about to expire (>2/3 duration)
            let notBefore = wrapper.certificate.notBefore;
            let totalDuration = expiration.getTime() - notBefore.getTime();
            let canRenewTs = Math.floor(totalDuration * 2/3 + notBefore.getTime());
            let canRenew = new Date(canRenewTs);
            console.debug("Can renew date : ", canRenew);

            if(now > canRenew) {
                // Generate a new certificate request
                throw new Error('todo - generate new CSR');
            }
        }
    }

    let loginInfo = await userLoginVerification(username, currentPublicKey, newPublicKey);
    console.debug("userLoginVerification OK, result: ", loginInfo);
    if(loginInfo) {
        // The user exists
        if(userDbInfo?.certificate && loginInfo.challenge_certificat) {
            // We got a challenge to authenticate with the certificate.
            await workers.connection.prepareMessageFactory(userDbInfo.certificate.privateKey, userDbInfo.certificate.certificate);
            let authenticationResponse = await certificateAuthentication(workers, loginInfo.challenge_certificat, 3_600);  // Todo - propagate session duration.
            return {authenticated: authenticationResponse.auth, userId: authenticationResponse.userId};
        } else {
            // Determine if we can authenticate with a security device (webauth).
            throw new Error("todo - webauth");
        }
    } else {
        // User does not exist. Allow registration of the unassigned username.
        return {register: true};
    }
}

type AuthenticationResponseType = {
    auth?: boolean,
    userId?: string,
}

async function certificateAuthentication(workers: AppWorkers, challenge: string, sessionDuration?: number): Promise<AuthenticationResponseType> {
    let data = {certificate_challenge: challenge, activation: true, dureeSession: sessionDuration};
    // Sign as a command
    // MESSAGE_KINDS.KIND_COMMANDE, data, {domaine: 'auth', action: 'authentifier_usager', ajouterCertificat: true}
    let command = await workers.connection.signAuthentication(data);
    console.debug("Auth command with challenge : ", command);
    let authenticationResult = await axios.post('/auth/authentifier_usager', command);
    console.debug("Authentication result ", authenticationResult);
    let responseMessage = authenticationResult.data as messageStruct.MilleGrillesMessage;
    let authenticationResponse = JSON.parse(responseMessage.contenu) as AuthenticationResponseType;
    return authenticationResponse
}

async function authenticateConnectionWorker(workers: AppWorkers, username: string, userSessionActive: boolean): Promise<PerformLoginResult> {
    // let workers = useWorkers();
    // let connectionReady = useConnectionStore((state) => state.connectionReady);
    // let userSessionActive = useConnectionStore((state) => state.userSessionActive);
    // let username = useConnectionStore((state) => state.username);
    // let setMustManuallyAuthenticate = useConnectionStore((state) => state.setMustManuallyAuthenticate);

    if(!workers) return {};  // Waiting for a connection

    console.debug("userSessionActive %s, username: %s", userSessionActive, username);

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
        // setMustManuallyAuthenticate(true);
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
        throw new Error('todo - Generate new CSR');
        return { mustManuallyAuthenticate: true };
    }

    // Initialize the message factory with the user's information.
    let { privateKey, certificate } = certificateInfo;
    await workers.connection.prepareMessageFactory(privateKey, certificate);

    // Authenticate the connection
    await workers.connection.authenticate();

    return { authenticated: true };
}
