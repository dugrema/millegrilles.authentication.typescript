import { useState, useCallback, useEffect, useMemo, MouseEvent, MouseEventHandler, Dispatch, SyntheticEvent } from 'react';
import { Popover } from 'flowbite-react';
import { proxy } from 'comlink';

import { createCertificateRequest, LanguageSelectbox, prepareRenewalIfDue, userLoginVerification } from './Login';
import VersionInfo from './VersionInfo';
import useUserStore from './connectionStore';
import useWorkers from './workers/WorkerProvider';
import { AppWorkers } from './workers/workers';
import { getUser, updateUser } from './idb/userStoreIdb';

import KeyIcon from './resources/key-svgrepo-com.svg';
import StarIcon from './resources/collect-svgrepo-com.svg';
import SwitchIcon from './resources/switch-svgrepo-com.svg';
import ForwardIcon from './resources/forward-svgrepo-com.svg';
import SetupIcon from './resources/set-up-svgrepo-com.svg';
import { useTranslation } from 'react-i18next';
import cleanup from './idb/cleanup';
// import { MessageResponse, SubscriptionMessage } from './workers/';
import { MessageResponse, SubscriptionMessage } from 'millegrilles.reactdeps.typescript';
import useConnectionStore from './connectionStore';
import { certificates, messageStruct } from 'millegrilles.cryptography';
import { prepareAuthentication, PrepareAuthenticationResult, signAuthenticationRequest } from './webauthn';
import { ApplicationInfo, ReponseListeApplicationsDeployeesV2 } from './workers/responseTypes';

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

    const { t } = useTranslation();
    const workers = useWorkers();

    const username = useUserStore(state=>state.username);
    const certificateRenewable = useUserStore(state=>state.certificateRenewable);
    const setCertificateRenewable = useUserStore(state=>state.setCertificateRenewable);
    const signatureReady = useUserStore(state=>state.signatureReady);
    const connectionInsecure = useUserStore(state=>state.connectionInsecure);
    const connectionAuthenticated = useConnectionStore(state=>state.connectionAuthenticated);

    const {logout, setPage} = props;

    const logoutClickHandler = useCallback((e: any)=>{
        let timeout = setTimeout(()=>logout(e), 300);  // In case of issue with the cleanup (finally doesn't get called).
        cleanup(username)
            .catch(err=>console.error("Error cleaning up before logout", err))
            .finally(()=>{
                clearTimeout(timeout);
                logout(e);
            });
    }, [username, logout]);

    const sectionChangeHandler = useCallback((e: SyntheticEvent)=>{
        const target = e.target as HTMLInputElement;
        const pageName = target?target.value:null;
        if(pageName) setPage(pageName);
    }, [setPage]);

    const userEventCallback = useMemo(()=>proxy(async (e: any) => {
        // Check if the delegations_date is > than current certificate.
        const message = e.message as UserUpdateEvent;
        const deletagions_date = message.delegations_date;
        const certificate = await workers?.connection.getMessageFactoryCertificate();
        const notBeforeDate = certificate?.certificate.notBefore;
        if(!notBeforeDate || !deletagions_date || notBeforeDate.getTime() < deletagions_date*1000) {
            setCertificateRenewable(true);
        }
    }), [workers, setCertificateRenewable]);

    useEffect(()=>{
        if(!workers || !connectionAuthenticated || !signatureReady) return;
        workers.connection.subscribe('userAccountEvents', userEventCallback)
            .catch(err=>console.error("Error subscribing for account events", err));
        return () => {
            workers?.connection.unsubscribe('userAccountEvents', userEventCallback)
                .catch(err=>{
                    // Note  : this error occurs if the page changes (e.g. logout)
                    console.info("Error unsubscribing for account events: " + err);
                });
        }
    }, [workers, connectionAuthenticated, signatureReady, userEventCallback])

    return (
        <div>
            <div className='pb-4 font-semibold'>
                <LanguagePopover /> {username}.
            </div>
            <p className='text-3xl font-bold text-slate-400 pb-10'>{t('screens.applicationList.title')}</p>
            <div className='grid grid-cols-1 px-4 md:px-20 lg:px-56 justify-items-center'>
                
                {connectionInsecure?<span></span>:
                    <div className='border-t border-l border-r rounded-t-lg border-slate-500 text-start p-2 w-full'>
                        <button className='font-semibold hover:underline' onClick={sectionChangeHandler} value='ActivateCode'>
                            <img src={KeyIcon} className="inline w-10 mr-1" alt='key icon' />
                            {t('screens.applicationList.activateACode')}
                        </button>
                        <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>
                            {t('screens.applicationList.activateACodeDescription')}
                        </blockquote>
                    </div>
                }
                
                <div className='border-t border-l border-r border-slate-500 text-start p-2 w-full'>
                    <button className='font-semibold hover:underline' onClick={sectionChangeHandler} value='AddSecurityDevice'>
                        <img src={KeyIcon} className="inline w-10 mr-1" alt='key icon' />
                        {t('screens.applicationList.addSecurityDevice')}
                    </button>
                    <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>
                        {connectionInsecure?
                            <p className='text-lg'>{t('screens.applicationList.insecureAccount')}</p>
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

    const { t } = useTranslation();

    const content = (
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
    name?: string,
    description?: string,
    application: string,
    instance_id: string,
    name_property: string,
    securite: string,
    url: string,
    supporte_usagers?: boolean,
    labels?: {[key: string]: {name?:string, description?:string}}
}

function InstalledApplications() {

    const { t, i18n } = useTranslation();
    const languages = i18n.languages;

    const workers = useWorkers();
    const [apps, setApps] = useState<Array<InstalledApplicationType>>();
    const connectionReady = useUserStore(state=>state.connectionReady); 
    const connectionAuthenticated = useUserStore(state=>state.connectionAuthenticated); 
    const signatureReady = useUserStore(state=>state.signatureReady);
    const ready = useMemo(()=>connectionReady && connectionAuthenticated && signatureReady, [connectionReady, connectionAuthenticated, signatureReady]);

    useEffect(()=>{
        if(!workers || !ready) return;
        workers.connection.getApplicationList()
            .then(async result=>{
                if(!workers) throw new Error("Workers not initialized");
                if(result.ok) {
                    console.debug("Applications list (V2)", result);
                    const apps = await processApplicationListResultV2(workers, result, languages);
                    setApps(apps);
                }
            })
            .catch(err=>console.error("Error loading application list", err));
    }, [workers, ready, setApps, languages]);

    const list = apps?.map((app, idx)=>{
        const adminApp = app.securite === '3.protege';
        const icon = adminApp?SetupIcon:ForwardIcon;
        return (
            <div key={''+idx} className='border-t border-l border-r border-slate-500 text-start p-2 w-full'>
                <a href={app.url} className='font-semibold hover:underline' rel="noopener noreferrer">
                    <img src={icon} className="inline w-10 mr-1" alt='key icon' />
                    {app.name}
                </a>
                {adminApp?<p>{t('screens.applicationList.adminApp')}</p>:<span></span>}
                <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>
                    {app.description}
                </blockquote>
            </div>
        )
    });

    return <>{list}</>;
}

function VerifyCertificateRenewal() {

    const workers = useWorkers();

    const username = useUserStore(state=>state.username);
    const certificateRemoteVersions = useUserStore(state=>state.certificateRemoteVersions);
    const setCertificateRemoteVersions = useUserStore(state=>state.setCertificateRemoteVersions);
    const setCertificateRenewable = useUserStore(state=>state.setCertificateRenewable);
    const connectionReady = useUserStore(state=>state.connectionReady); 
    const connectionAuthenticated = useUserStore(state=>state.connectionAuthenticated); 
    const signatureReady = useUserStore(state=>state.signatureReady);
    const ready = useMemo(()=>connectionReady && connectionAuthenticated && signatureReady, [connectionReady, connectionAuthenticated, signatureReady]);

    useEffect(()=>{
        if(!workers || !ready) return;
        const hostname = window.location.hostname;
        workers.connection.getCurrentUserDetail(username, hostname)
            .then((result)=>{
                const delegations_version = result.compte?.delegations_version;
                const delegations_date = result.compte?.delegations_date;
                if(delegations_version && delegations_date) {
                    setCertificateRemoteVersions({version: delegations_version, date: delegations_date});
                }
            })
            .catch((err: any)=>console.error("Error loading user detail for certificate update ", err));

    }, [workers, ready, username, setCertificateRemoteVersions])

    useEffect(()=>{
        console.debug("Loading username %s, ready %s", username, ready);
        // Load local IDB version
        getUser(username)
            .then(async userIdb => {
                if(userIdb?.request) {
                    // We already have a pending request
                    // Flag the certificate as obsolete/renewable
                    setCertificateRenewable(true);
                    return;
                }

                if(!workers || !ready) return;

                // Check if the certificate is about to expire
                const certificate = await workers.connection.getMessageFactoryCertificate();
                // console.debug("Message factory certificate", certificate);
                if(certificate) {
                    try {
                        const due = await prepareRenewalIfDue(workers, certificate);
                        if(due) {
                            // A new request was generated
                            // Flag the certificate as obsolete/renewable
                            setCertificateRenewable(true);
                            return;
                        }
                    } catch(err) {
                        console.warn("Error checking user certificate for renewal: %s", err);
                    }
                }
                
                if(!certificateRemoteVersions) return

                // console.debug("Certificate not-before: ", certificate?.certificate);
                // @ts-ignore
                const tbsCertificateObject = certificate?.certificate?.asn?.tbsCertificate || certificate?.certificate;
                // console.debug("Certificate tbsCertificateObject: ", tbsCertificateObject);
                // @ts-ignore
                const notBeforeDate = tbsCertificateObject.validity?.notBefore?.utcTime;
                // console.debug("Certificate notBeforeDate: ", notBeforeDate);
                if(!notBeforeDate) throw new Error('The certificate has no NotBefore date. This is invalid.');
                
                const notBeforeEpochSecs = notBeforeDate.getTime() / 1000;  // Convert to seconds
                // console.debug("Not before epoch secs", notBeforeEpochSecs)

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
    }, [workers, ready, certificateRemoteVersions, username, setCertificateRenewable])

    return <span></span>;
}

export type RenewCertificateProps = {
    buttonOnly?: boolean,
    className?: string,
    onSuccess?: () => void,
    onError?: (e: Error) => void,
};

export function RenewCertificate(props?: RenewCertificateProps) {

    const { t } = useTranslation();
    const buttonOnly = props?.buttonOnly;
    const className = props?.className || '';
    const onSuccess = props?.onSuccess;
    const onError = props?.onError;

    const workers = useWorkers();
    const username = useUserStore(state=>state.username);
    const setCertificateRemoteVersions = useUserStore(state=>state.setCertificateRemoteVersions);
    const setCertificateRenewable = useUserStore(state=>state.setCertificateRenewable);
    const setSignatureReady = useUserStore(state=>state.setSignatureReady);

    const [challenge, setChallenge] = useState<PrepareAuthenticationResult>();
    const [disabled, setDisabled] = useState(false);

    const signHandler = useCallback(()=>{
        if(!challenge) throw new Error("Challenge not ready");
        setDisabled(true);
        signAuthenticationRequest(username, challenge.demandeCertificat, challenge.publicKey)
            .then(async signedRequest=>{
                if(!challenge) {
                    const error = new Error('challenge missing');
                    if(onError) return onError(error);
                    else throw error;
                }

                const command = {
                    demandeCertificat: signedRequest.demandeCertificat,
                    challenge: challenge.challengeReference,
                    hostname: window.location.hostname,
                    clientAssertionResponse: signedRequest.webauthn,
                };
                const response = await workers?.connection.signUserAccount(command);
                if(response?.ok && response?.certificat) {
                    // Success. Save the new certificate and start using it.
                    // Get the newly generated certificate chain. The last one is the CA, remove it from the chain.
                    const certificate = response?.certificat;
                    const ca = certificate.pop();

                    const userIdb = await getUser(username);
                    const certificateRequest = userIdb?.request;
                    if(!certificateRequest) {
                        const error = new Error("Error during certificate renewal, no active certificate available");
                        if(onError) return onError(error);
                        else throw error;
                    }

                    const certificateEntry = {
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
                    // console.trace("Preparing message factory with ", certificate);
                    await workers?.connection.prepareMessageFactory(certificateRequest.privateKey, certificate);

                    // Cleanup screen, this removes the <RenewCertificate> element.
                    setCertificateRemoteVersions(undefined);
                    setCertificateRenewable(false);
                    setSignatureReady(true);  // Message factory setup done

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
        <button onClick={signHandler} className={'btn ' + className} disabled={disabled || !challenge}>
            Renew certificate
        </button>
    );

    return (
        <div className='border-t border-l border-r border-slate-500 text-start p-2 w-full'>
            <button onClick={signHandler} className='font-semibold hover:underline' disabled={disabled || !challenge}>
                <img src={StarIcon} className="inline w-10 mr-1" alt='key icon' />
                {t('screens.applicationList.renewCertificate')}
            </button>
            <p>Action required</p>
            <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>
                {t('screens.applicationList.renewCertificateDetail')}
            </blockquote>
        </div>
    );
}

/** Checks if the user account has the activate: true flag. */
function CheckActivationStatus() {
    const workers = useWorkers();
    const username = useUserStore(state=>state.username);
    const setConnectionInsecure = useUserStore(state=>state.setConnectionInsecure);
    
    const connectionReady = useUserStore(state=>state.connectionReady);
    const signatureReady = useUserStore(state=>state.signatureReady);
    const ready = useMemo(()=>connectionReady && signatureReady, [connectionReady, signatureReady]);

    useEffect(()=>{
        if(!workers || !ready || !username) return;

        userLoginVerification(username)
            .then(result=>{
                if(result?.methodesDisponibles?.activation) {
                    // This browser can connect without webauthn
                    setConnectionInsecure(true);
                }
            })
            .catch(err=>console.error("Error checking user status ", err));
    }, [workers, ready, username, setConnectionInsecure]);

    return <span></span>;
}

// async function processApplicationListResult(workers: AppWorkers, message: MessageResponse, languages: readonly string[]): Promise<Array<InstalledApplicationType>> {
//     const urlLocal = new URL(window.location.href)

//     // @ts-ignore
//     let apps = message.resultats as Array<InstalledApplicationType>;

//     // Read the "serveur" attachement to get the local instance_id from its certificate.
//     // @ts-ignore
//     let serverMessage = message['__original']?.attachements?.serveur as messageStruct.MilleGrillesMessage;
//     let verifiedServerMessage = await workers?.connection?.verifyMessage(serverMessage);
//     // @ts-ignore
//     let certificate = verifiedServerMessage['__certificate'] as certificates.CertificateWrapper;
//     if(!certificate) throw new Error('Invalid "serveur" attachement');
//     let instanceId = certificate.extensions?.commonName;

//     // Filter out applications that should not be shown
//     apps = apps.filter(item=>{
//             if(item.instance_id !== instanceId) return false;  // Not local
//             if(item.supporte_usagers === false) return false;  // Not meant for users
//             return true
//         });

//     // Update names
//     apps.forEach(app=>{
//         app.name_property = app.name_property[0].toLocaleUpperCase() + app.name_property.slice(1);
//         app.name_property = app.name_property.replace(/_/g, ' ');

//         // Default
//         let name = app.name_property[0].toLocaleUpperCase() + app.name_property.slice(1);
//         name = name.replace(/_/g, ' ');
//         app.name = name;

//         // Override default if labels found
//         for(let language of languages) {
//             if(app.labels && app.labels[language]) {
//                 let languageLabels = app.labels[language];
//                 app.name = languageLabels.name;
//                 app.description = languageLabels.description;
//                 break;
//             }
//         }
        
//         // Adapt url to local hostname:port
//         try {
//             let appUrl = new URL(app.url);
//             appUrl.hostname = urlLocal.hostname;
//             appUrl.port = urlLocal.port;
//             app.url = appUrl.href;  // Override app url
//         } catch(err) {
//             console.warn("Error mapping application url %s: %O", app.url, err);
//         }

//     })

//     // Sort
//     apps.sort((a, b) => {
//         let valA = a.name || a.name_property;
//         let valB = b.name || b.name_property;
//         return valA.toLocaleLowerCase().localeCompare(valB.toLocaleLowerCase())
//     });

//     return apps;
// }

async function processApplicationListResultV2(workers: AppWorkers, message: ReponseListeApplicationsDeployeesV2, languages: readonly string[]): Promise<Array<InstalledApplicationType>> {
    const urlLocal = new URL(window.location.href)

    if(!message.ok) throw new Error(`Error receiving response: ${message.err}`)

    const apps = message.results;

    // Read the "serveur" attachement to get the local instance_id from its certificate.
    const serverMessage = message['__original']?.attachements?.serveur as messageStruct.MilleGrillesMessage;
    const verifiedServerMessage = await workers?.connection?.verifyMessage(serverMessage);
    
    const certificate = verifiedServerMessage['__certificate'] as certificates.CertificateWrapper;
    if(!certificate) throw new Error('Invalid "serveur" attachement');
    const instanceId = certificate.extensions?.commonName;

    const instanceApplications = apps.filter(instance=>instance.instance_id === instanceId).pop();
    if(!instanceApplications) throw new Error("No application information was received for this instance");

    console.debug("Instance applications", instanceApplications);

    // Filter out applications that should not be shown
    const filteredApplications: Record<string, ApplicationInfo> = {};
    for (const [appName, appInfo] of Object.entries(instanceApplications.applications)) {
        // console.log(`Application Name: ${appName}`);
        // console.log(`Version: ${appInfo.version}`);
        
        // Filter out API only values
        appInfo.web = appInfo.web?.filter(web=>!web.api);

        // Accessing nested arrays like web components
        // appInfo.web?.forEach(web => {
        //     console.log(`- Web port: ${web.port}`);
        // });

        // Only keep apps with at least one web entry
        if(appInfo.web?.length) {
            filteredApplications[appName] = appInfo;
        }
    }

    console.debug("Remaining apps: ", filteredApplications);

    const finalList = [] as Array<InstalledApplicationType>;
    const language = languages[0];
    const baseLanguage = language?language.split('-')[0]:language;

    for (const [appName, appInfo] of Object.entries(filteredApplications)) {
        if(!appInfo.web) continue;  // Should have be filtered out already
        for (const webEntry of appInfo.web) {
            // Adapt url to local hostname:port
            let url = null as string | null;
            try {
                if(webEntry.url) {
                    const appUrl = new URL(webEntry.url);
                    appUrl.hostname = urlLocal.hostname;
                    appUrl.port = urlLocal.port;
                    url = appUrl.href;
                } else if(webEntry.port || webEntry.path) {
                    const appUrl = new URL(urlLocal.href);
                    appUrl.port = ''+webEntry.port || appUrl.port;
                    appUrl.pathname = webEntry.path || urlLocal.pathname;
                    url = appUrl.href;
                }
            } catch(err) {
                console.warn("Error mapping application url %s: %O", webEntry.url, err);
            }

            let displayedName = appName;
            const labels = webEntry.labels || appInfo.labels;
            if(language && labels) {
                displayedName = labels[language] || labels[baseLanguage] || appName;
            }

            const entry = {
                name: displayedName,
                description: undefined,
                application: appName,
                instance_id: instanceApplications.instance_id,
                name_property: appName,
                securite: appInfo.securite || instanceApplications.securite,
                url: url || webEntry.path || appInfo.path,
                supporte_usagers: true,
                labels: appInfo.labels
            } as InstalledApplicationType;
            finalList.push(entry);
        }
    }

    // Sort
    console.debug("Sort in language: ", language);
    finalList.sort((a, b) => {
        const valA = a.name || a.name_property;
        const valB = b.name || b.name_property;
        return valA.toLocaleLowerCase().localeCompare(valB.toLocaleLowerCase())
    });

    return finalList;
}
