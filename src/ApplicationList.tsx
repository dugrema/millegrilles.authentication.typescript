import { useState, useCallback, useEffect, MouseEvent, MouseEventHandler, Dispatch, SyntheticEvent } from 'react';
import { Popover } from 'flowbite-react';
import { createCertificateRequest, LanguageSelectbox, prepareAuthentication, PrepareAuthenticationResult, prepareRenewalIfDue, signAuthenticationRequest } from './Login';
import VersionInfo from './VersionInfo';
import useUserStore from './connectionStore';
import useWorkers from './workers/workers';
import { getUser, updateUser } from './idb/userStoreIdb';

import KeyIcon from './resources/key-svgrepo-com.svg';
import StarIcon from './resources/collect-svgrepo-com.svg';
import SwitchIcon from './resources/switch-svgrepo-com.svg';
import ForwardIcon from './resources/forward-svgrepo-com.svg';
import SetupIcon from './resources/set-up-svgrepo-com.svg';

type ApplicationListProps = {
    logout: MouseEventHandler<MouseEvent>,
    setPage: Dispatch<string>,
};

function ApplicationList(props: ApplicationListProps) {

    let username = useUserStore(state=>state.username);
    let certificateRenewable = useUserStore(state=>state.certificateRenewable);

    let {logout, setPage} = props;

    let logoutClickHandler = useCallback((e: any)=>{
        console.debug("Log out");
        logout(e);
    }, [logout]);

    let sectionChangeHandler = useCallback((e: SyntheticEvent)=>{
        let target = e.target as HTMLInputElement;
        let pageName = target?target.value:null;
        if(pageName) setPage(pageName);
    }, [setPage]);

    return (
        <div>
            <div className='pb-4 font-semibold'>
                <LanguagePopover /> {username}.
            </div>
            <p className='text-3xl font-bold text-slate-400 pb-10'>MilleGrilles applications</p>
            <div className='grid grid-cols-1 px-4 md:px-20 lg:px-56 justify-items-center'>
                
                <div className='border-t border-l border-r rounded-t-lg border-slate-500 text-start p-2 w-full'>
                    <button className='font-semibold hover:underline' onClick={sectionChangeHandler} value='ActivateCode'>
                        <img src={KeyIcon} className="inline w-10 mr-1" alt='key icon' />
                        Activate a code
                    </button>
                    <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>
                        Activate another device on this account using an activation code (e.g. abcd-1234) or QR code.
                    </blockquote>
                </div>
                
                <div className='border-t border-l border-r border-slate-500 text-start p-2 w-full'>
                    <button className='font-semibold hover:underline' onClick={sectionChangeHandler} value='AddSecurityDevice'>
                        <img src={KeyIcon} className="inline w-10 mr-1" alt='key icon' />
                        Add security device
                    </button>
                    <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>
                        Add a new security device to access your account. This can be a USB security token, Apple/Android device, etc. 
                    </blockquote>
                </div>

                {certificateRenewable?<RenewCertificate />:<span></span>}

                <InstalledApplications />

                <div className='border rounded-b-lg border-slate-500 text-start p-2 w-full'>
                    <button className='hover:underline font-semibold' onClick={logoutClickHandler}>
                        <img src={SwitchIcon} className="inline w-10 mr-1" alt='swtich icon' />
                        Logout
                    </button>
                    <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>Close session and clear secrets.</blockquote>
                </div>
            
            </div>
            <VersionInfo />
            <VerifyCertificateRenewal />
        </div>
    );
}

export default ApplicationList;

function LanguagePopover() {

    let content = (
        <div className='min-w-80 text-sm text-gray-400 border-gray-600 bg-gray-800'>
            <div className="px-3 py-2 border-b rounded-t-lg border-gray-600 bg-gray-700">
                <h3 className="font-semibold text-white">Change language</h3>
            </div>
            <div className="py-4 text-nowrap text-left w-56">
                <LanguageSelectbox />
            </div>
        </div>
    );

    return (
        <Popover content={content}>
            <button className='underline'>Hi</button>
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

    let workers = useWorkers();
    let [apps, setApps] = useState<Array<InstalledApplicationType>>([]);

    useEffect(()=>{
        if(!workers) return;
        console.debug("Load application list");
        workers.connection.getApplicationList()
            .then(result=>{
                console.debug("Result ", result);
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
    }, [workers, setApps])

    let list = apps.map((app, idx)=>{
        console.debug("App ", app);
        let adminApp = app.securite === '3.protege';
        let icon = adminApp?SetupIcon:ForwardIcon;
        return (
            <div key={''+idx} className='border-t border-l border-r border-slate-500 text-start p-2 w-full'>
                <a href={app.url} className='font-semibold hover:underline'>
                    <img src={icon} className="inline w-10 mr-1" alt='key icon' />
                    {app.name_property}
                </a>
                {adminApp?<p>Administrative application</p>:<span></span>}
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
                console.debug("User detail ", result);
                let delegations_version = result.compte?.delegations_version;
                let delegations_date = result.compte?.delegations_date;
                if(delegations_version && delegations_date) {
                    console.debug("Set remote versions %O, date %O", delegations_version, delegations_date)
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

                console.debug("Compare idb %O (notBefore epoch %s) to remote %O", userIdb, notBeforeDate, certificateRemoteVersions);
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
    }, [workers, certificateRemoteVersions, username])

    return <span></span>;
}

function RenewCertificate() {

    let workers = useWorkers();
    let username = useUserStore(state=>state.username);
    let setCertificateRemoteVersions = useUserStore(state=>state.setCertificateRemoteVersions);
    let setCertificateRenewable = useUserStore(state=>state.setCertificateRenewable);

    let [challenge, setChallenge] = useState<PrepareAuthenticationResult>();

    let signHandler = useCallback(()=>{
        if(!challenge) throw new Error("Challenge not ready");
        signAuthenticationRequest(username, challenge.demandeCertificat, challenge.publicKey)
            .then(async signedRequest=>{
                console.debug("Signed request ", signedRequest);
                if(!challenge) throw new Error("challenge missing");

                let command = {
                    demandeCertificat: signedRequest.demandeCertificat,
                    challenge: challenge.challengeReference,
                    hostname: window.location.hostname,
                    clientAssertionResponse: signedRequest.webauthn,
                };
                let response = await workers?.connection.signUserAccount(command);
                console.debug("Sign account response ", response);
                if(response?.ok && response?.certificat) {
                    // Success. Save the new certificate and start using it.
                    // Get the newly generated certificate chain. The last one is the CA, remove it from the chain.
                    let certificate = response?.certificat;
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

                    // Update the message factory to start using the new certificate immediately
                    await workers?.connection.prepareMessageFactory(certificateRequest.privateKey, certificate);

                    // Cleanup screen, this removes the <RenewCertificate> element.
                    setCertificateRemoteVersions(undefined);
                    setCertificateRenewable(false);
                }
            })
            .catch(err=>console.error("Error renewing certificate", err));
    }, [username, challenge, setCertificateRemoteVersions, setCertificateRenewable]);

    // Pre-emptive loading of user authentication information
    useEffect(()=>{
        let hostname = window.location.hostname;
        workers?.connection.getCurrentUserDetail(username, hostname)
            .then(async userInfo => {
                console.debug("Loaded user info ", userInfo);
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
                            console.debug("Use existing CSR");
                            csr = user?.request.pem;
                        }
                    }
        
                    let preparedChallenge = await prepareAuthentication(username, webauthnChallenge, csr, false);
                    console.debug("Challenge ready : ", preparedChallenge);
                    setChallenge(preparedChallenge);
                }
            })
            .catch(err=>console.error("Error preparing webauthn signature"));
        
    }, [workers, username, setChallenge])

    return (
        <div className='border-t border-l border-r border-slate-500 text-start p-2 w-full'>
            <button onClick={signHandler} className='font-semibold hover:underline' disabled={!challenge}>
                <img src={StarIcon} className="inline w-10 mr-1" alt='key icon' />
                Renew this browser's certificate
            </button>
            <p>Action required</p>
            <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>
                This renews the browser's connection. This is regular security check on your
                account and requires your security device.
            </blockquote>
        </div>
    )        
}
