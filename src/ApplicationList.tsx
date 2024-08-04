import { useState, useCallback, useEffect, useMemo, MouseEvent, MouseEventHandler, Dispatch, SyntheticEvent } from 'react';
import { Popover } from 'flowbite-react';
import { proxy } from 'comlink';

import { createCertificateRequest, LanguageSelectbox, prepareAuthentication, PrepareAuthenticationResult, prepareRenewalIfDue, signAuthenticationRequest, userLoginVerification } from './Login';
import VersionInfo from './VersionInfo';
import useUserStore from './connectionStore';
import useWorkers from './workers/workers';
import { getUser, updateUser } from './idb/userStoreIdb';

import KeyIcon from './resources/key-svgrepo-com.svg';
import StarIcon from './resources/collect-svgrepo-com.svg';
import SwitchIcon from './resources/switch-svgrepo-com.svg';
import ForwardIcon from './resources/forward-svgrepo-com.svg';
import SetupIcon from './resources/set-up-svgrepo-com.svg';
import { useTranslation } from 'react-i18next';
import cleanup from './idb/cleanup';
import { MessageResponse, SubscriptionMessage } from './workers/connectionV3';
import useConnectionStore from './connectionStore';
import { messageStruct } from 'millegrilles.cryptography';

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

type ApplicationListProps = {
    logout: MouseEventHandler<MouseEvent>,
    setPage: Dispatch<string>,
};

type UserUpdateEvent = (MessageResponse | messageStruct.MilleGrillesMessage) & {
    delegations_date?: number,
    delegations_version?: number,
    delegation_globale?: string,
    compte_prive?: boolean,
    nomUsager?: string,
    userId?: string,
}

function ApplicationList(props: ApplicationListProps) {

    let { t } = useTranslation();
    let workers = useWorkers();

    let username = useUserStore(state=>state.username);
    let certificateRenewable = useUserStore(state=>state.certificateRenewable);
    let setCertificateRenewable = useUserStore(state=>state.setCertificateRenewable);
    let connectionInsecure = useUserStore(state=>state.connectionInsecure);
    let connectionAuthenticated = useConnectionStore(state=>state.connectionAuthenticated);

    let {logout, setPage} = props;

    let logoutClickHandler = useCallback((e: any)=>{
        cleanup(username)
            .finally(()=>{
                logout(e);
            });
    }, [username, logout]);

    let sectionChangeHandler = useCallback((e: SyntheticEvent)=>{
        let target = e.target as HTMLInputElement;
        let pageName = target?target.value:null;
        if(pageName) setPage(pageName);
    }, [setPage]);

    let userEventCallback = useMemo(()=>proxy(async (e: SubscriptionMessage) => {
        // Check if the delegations_date is > than current certificate.
        let message = e.message as UserUpdateEvent;
        let deletagions_date = message.delegations_date;
        let certificate = await workers?.connection.getMessageFactoryCertificate();
        let notBeforeDate = certificate?.certificate.notBefore;
        if(!notBeforeDate || !deletagions_date || notBeforeDate.getTime() < deletagions_date*1000) {
            setCertificateRenewable(true);
        }
    }), [workers, setCertificateRenewable]);

    useEffect(()=>{
        if(!workers || !connectionAuthenticated) return;
        workers.connection.subscribe('userAccountEvents', userEventCallback)
            .catch(err=>console.error("Error subscribing for account events", err));
        return () => {
            workers?.connection.unsubscribe('userAccountEvents', userEventCallback)
                .catch(err=>{
                    // Note  : this error occurs if the page changes (e.g. logout)
                    console.info("Error unsubscribing for account events: " + err);
                });
        }
    }, [workers, connectionAuthenticated, userEventCallback])

    return (
        <div>
            <div className='pb-4 font-semibold'>
                <LanguagePopover /> {username}.
            </div>
            <p className='text-3xl font-bold text-slate-400 pb-10'>{t('screens.applicationList.title')}</p>
            <div className='grid grid-cols-1 px-4 md:px-20 lg:px-56 justify-items-center'>
                
                <div className='border-t border-l border-r rounded-t-lg border-slate-500 text-start p-2 w-full'>
                    <button className='font-semibold hover:underline' onClick={sectionChangeHandler} value='ActivateCode'>
                        <img src={KeyIcon} className="inline w-10 mr-1" alt='key icon' />
                        {t('screens.applicationList.activateACode')}
                    </button>
                    <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>
                        {t('screens.applicationList.activateACodeDescription')}
                    </blockquote>
                </div>
                
                <div className='border-t border-l border-r border-slate-500 text-start p-2 w-full'>
                    <button className='font-semibold hover:underline' onClick={sectionChangeHandler} value='AddSecurityDevice'>
                        <img src={KeyIcon} className="inline w-10 mr-1" alt='key icon' />
                        {t('screens.applicationList.addSecurityDevice')}
                    </button>
                    <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>
                        {connectionInsecure?
                            <p className='text-lg'>Access to your account from this browser is <span className='font-bold'>not secured properly</span>.</p>
                            :
                            <span></span>
                        }
                        {t('screens.applicationList.addSecurityDeviceDescription')}
                    </blockquote>
                </div>

                {certificateRenewable?<RenewCertificate />:<span></span>}

                <InstalledApplications />

                <div className='border rounded-b-lg border-slate-500 text-start p-2 w-full'>
                    <button className='hover:underline font-semibold' onClick={logoutClickHandler}>
                        <img src={SwitchIcon} className="inline w-10 mr-1" alt='swtich icon' />
                        {t('labels.logout')}
                    </button>
                    <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>{t('screens.applicationList.logoutDescription')}</blockquote>
                </div>
            
            </div>
            <VersionInfo />
            <VerifyCertificateRenewal />
            <CheckActivationStatus />
        </div>
    );
}

export default ApplicationList;

function LanguagePopover() {

    let { t } = useTranslation();

    let content = (
        <div className='min-w-80 text-sm text-gray-400 border-gray-600 bg-gray-800'>
            <div className="px-3 py-2 border-b rounded-t-lg border-gray-600 bg-gray-700">
                <h3 className="font-semibold text-white">{t('labels.changeLanguage')}</h3>
            </div>
            <div className="py-4 text-nowrap text-left w-56">
                <LanguageSelectbox />
            </div>
        </div>
    );

    return (
        <Popover content={content}>
            <button className='underline'>{t('screens.applicationList.hi')}</button>
        </Popover>
    )
}

type InstalledApplicationType = {
    application: string,
    instance_id: string,
    name_property: string,
    securite: string,
    url: string,
}

function InstalledApplications() {

    let { t } = useTranslation();

    let workers = useWorkers();
    let [apps, setApps] = useState<Array<InstalledApplicationType>>();

    useEffect(()=>{
        if(!workers) return;
        workers.connection.getApplicationList()
            .then(result=>{
                if(result.ok) {
                    // @ts-ignore
                    let apps = result.resultats as Array<InstalledApplicationType>;

                    // Sort
                    apps.sort((a, b) => a.name_property.toLocaleLowerCase().localeCompare(b.name_property.toLocaleLowerCase()));

                    // Update names
                    apps.forEach(app=>{
                        app.name_property = app.name_property[0].toLocaleUpperCase() + app.name_property.slice(1);
                        app.name_property = app.name_property.replace(/_/g, ' ');
                    })

                    setApps(apps);
                }
            })
            .catch(err=>console.error("Error loading application list", err));
    }, [workers, setApps]);

    let list = apps?.map((app, idx)=>{
        let adminApp = app.securite === '3.protege';
        let icon = adminApp?SetupIcon:ForwardIcon;
        return (
            <div key={''+idx} className='border-t border-l border-r border-slate-500 text-start p-2 w-full'>
                <a href={app.url} className='font-semibold hover:underline'>
                    <img src={icon} className="inline w-10 mr-1" alt='key icon' />
                    {app.name_property}
                </a>
                {adminApp?<p>{t('screens.applicationList.adminApp')}</p>:<span></span>}
                <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>
                    
                </blockquote>
            </div>
        )
    });

    return <>{list}</>;
}

function VerifyCertificateRenewal() {

    let workers = useWorkers();

    let username = useUserStore(state=>state.username);
    let certificateRemoteVersions = useUserStore(state=>state.certificateRemoteVersions);
    let setCertificateRemoteVersions = useUserStore(state=>state.setCertificateRemoteVersions);
    let setCertificateRenewable = useUserStore(state=>state.setCertificateRenewable);

    useEffect(()=>{
        if(!workers) return;
        let hostname = window.location.hostname;
        workers.connection.getCurrentUserDetail(username, hostname)
            .then((result)=>{
                let delegations_version = result.compte?.delegations_version;
                let delegations_date = result.compte?.delegations_date;
                if(delegations_version && delegations_date) {
                    setCertificateRemoteVersions({version: delegations_version, date: delegations_date});
                }
            })
            .catch((err: any)=>console.error("Error loading user detail for certificate update ", err));

    }, [workers, username, setCertificateRemoteVersions])

    useEffect(()=>{
        // Load local IDB version
        getUser(username)
            .then(async userIdb => {
                if(userIdb?.request) {
                    // We already have a pending request
                    // Flag the certificate as obsolete/renewable
                    setCertificateRenewable(true);
                    return;
                }

                if(!workers) return;

                // Check if the certificate is about to expire
                let certificate = await workers.connection.getMessageFactoryCertificate();
                if(certificate) {
                    let due = await prepareRenewalIfDue(workers, certificate);
                    if(due) {
                        // A new request was generated
                        // Flag the certificate as obsolete/renewable
                        setCertificateRenewable(true);
                        return;
                    }
                }
                
                if(!certificateRemoteVersions) return

                let notBeforeDate = certificate?.certificate.notBefore.getTime();
                if(!notBeforeDate) throw new Error('The certificate has no NotBefore date. This is invalid.');
                notBeforeDate = notBeforeDate / 1000;  // Convert to seconds

                if(certificateRemoteVersions.date > notBeforeDate) {
                    console.info("Updated certificate roles on the server");
                    let certificate = await workers.connection.getMessageFactoryCertificate();
                    let userId = certificate?.extensions?.userId;
                    if(!userIdb?.request) {
                        // Create new certificate request
                        await createCertificateRequest(workers, username, userId);
                    }
                    // Flag the certificate as obsolete/renewable
                    setCertificateRenewable(true);
                }
            })
            .catch(err=>console.error("Error loading user ", err));
    }, [workers, certificateRemoteVersions, username, setCertificateRenewable])

    return <span></span>;
}

export type RenewCertificateProps = {
    buttonOnly?: boolean,
    className?: string,
    onSuccess?: () => void,
    onError?: (e: Error) => void,
};

export function RenewCertificate(props?: RenewCertificateProps) {

    let buttonOnly = props?.buttonOnly;
    let className = props?.className || '';
    let onSuccess = props?.onSuccess;
    let onError = props?.onError;

    let workers = useWorkers();
    let username = useUserStore(state=>state.username);
    let setCertificateRemoteVersions = useUserStore(state=>state.setCertificateRemoteVersions);
    let setCertificateRenewable = useUserStore(state=>state.setCertificateRenewable);

    let [challenge, setChallenge] = useState<PrepareAuthenticationResult>();
    let [disabled, setDisabled] = useState(false);

    let signHandler = useCallback(()=>{
        if(!challenge) throw new Error("Challenge not ready");
        setDisabled(true);
        signAuthenticationRequest(username, challenge.demandeCertificat, challenge.publicKey)
            .then(async signedRequest=>{
                if(!challenge) {
                    let error = new Error('challenge missing');
                    if(onError) return onError(error);
                    else throw error;
                }

                let command = {
                    demandeCertificat: signedRequest.demandeCertificat,
                    challenge: challenge.challengeReference,
                    hostname: window.location.hostname,
                    clientAssertionResponse: signedRequest.webauthn,
                };
                let response = await workers?.connection.signUserAccount(command);
                if(response?.ok && response?.certificat) {
                    // Success. Save the new certificate and start using it.
                    // Get the newly generated certificate chain. The last one is the CA, remove it from the chain.
                    let certificate = response?.certificat;
                    let ca = certificate.pop();

                    let userIdb = await getUser(username);
                    let certificateRequest = userIdb?.request;
                    if(!certificateRequest) {
                        let error = new Error("Error during certificate renewal, no active certificate available");
                        if(onError) return onError(error);
                        else throw error;
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

                    // Update the message factory to start using the new certificate immediately
                    await workers?.connection.prepareMessageFactory(certificateRequest.privateKey, certificate);

                    // Cleanup screen, this removes the <RenewCertificate> element.
                    setCertificateRemoteVersions(undefined);
                    setCertificateRenewable(false);

                    // Success callback
                    if(onSuccess) onSuccess();
                } else {
                    let error = new Error(response?.err || 'Error signing account');
                    if(onError) onError(error);
                    else throw error;
                }
            })
            .catch(err=>{
                if(onError) onError(err);
                else console.error("Error renewing certificate", err)
            })
            .finally(()=>setDisabled(false));
    }, [workers, username, challenge, setCertificateRemoteVersions, setCertificateRenewable, setDisabled, onSuccess, onError]);

    // Pre-emptive loading of user authentication information
    useEffect(()=>{
        let hostname = window.location.hostname;
        workers?.connection.getCurrentUserDetail(username, hostname)
            .then(async userInfo => {
                let webauthnChallenge = userInfo?.authentication_challenge;
                if(webauthnChallenge) {
                    // Check if the user exists locally and verify if certificate should be renewed.
                    let csr: string | null = null;
                    let user = await getUser(username);
                    if(workers) {
                        if(!user?.request) {
                            let entry = await createCertificateRequest(workers, username);
                            csr = entry.pem;
                        } else if(user?.request) {
                            // Use the CSR for the signature
                            csr = user?.request.pem;
                        }
                    }
        
                    let preparedChallenge = await prepareAuthentication(username, webauthnChallenge, csr, false);
                    setChallenge(preparedChallenge);
                }
            })
            .catch(err=>console.error("Error preparing webauthn signature ", err));
        
    }, [workers, username, setChallenge])

    // Check if we show only a button (in admin screens)
    if(buttonOnly) return (
        <button onClick={signHandler} className={CLASSNAME_BUTTON + ' ' + className} disabled={disabled || !challenge}>
            Renew certificate
        </button>
    );

    return (
        <div className='border-t border-l border-r border-slate-500 text-start p-2 w-full'>
            <button onClick={signHandler} className='font-semibold hover:underline' disabled={disabled || !challenge}>
                <img src={StarIcon} className="inline w-10 mr-1" alt='key icon' />
                Renew this browser's certificate
            </button>
            <p>Action required</p>
            <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>
                This renews the browser's connection. This is regular security check on your
                account and requires your security device.
            </blockquote>
        </div>
    );
}

/** Checks if the user account has the activate: true flag. */
function CheckActivationStatus() {
    let workers = useWorkers();
    let username = useUserStore(state=>state.username);
    let setConnectionInsecure = useUserStore(state=>state.setConnectionInsecure);
    
    useEffect(()=>{
        if(!workers || !username) return;

        userLoginVerification(username)
            .then(result=>{
                if(result?.methodesDisponibles?.activation) {
                    // This browser can connect without webauthn
                    setConnectionInsecure(true);
                }
            })
            .catch(err=>console.error("Error checking user status ", err));
    }, [workers, username, setConnectionInsecure]);

    return <span></span>;
}
