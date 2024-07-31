import { useState, useCallback, useEffect, MouseEvent, MouseEventHandler, Dispatch, SyntheticEvent } from 'react';
import { Popover } from 'flowbite-react';
import { createCertificateRequest, LanguageSelectbox, prepareRenewalIfDue } from './Login';
import KeyIcon from './resources/key-svgrepo-com.svg';
import StarIcon from './resources/collect-svgrepo-com.svg';
import SwitchIcon from './resources/switch-svgrepo-com.svg';
import VersionInfo from './VersionInfo';
import useUserStore from './connectionStore';
import useWorkers from './workers/workers';
import { getUser } from './idb/userStoreIdb';

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

                {certificateRenewable?
                    <div className='border-t border-l border-r border-slate-500 text-start p-2 w-full'>
                        <button className='font-semibold hover:underline'>
                            <img src={StarIcon} className="inline w-10 mr-1" alt='key icon' />
                            Renew this browser's certificate
                        </button>
                        <p>Action required</p>
                        <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>
                            This renews the browser's connection. This is regular security check on your
                            account and requires your security device.
                        </blockquote>
                    </div>
                :<span></span>}

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

function InstalledApplications() {

    let workers = useWorkers();
    let [apps, setApps] = useState<Array<Object>>([]);

    useEffect(()=>{
        if(!workers) return;

        console.debug("Load application list");
        workers.connection.getApplicationList()
            .then(result=>{
                console.debug("Result ", result);
            })
            .catch(err=>console.error("Error loading application list", err));

    }, [workers])

    let list = apps.map((app, idx)=>{
        console.debug("App ", app);
        return (
            <div key={''+idx} className='border-t border-l border-r border-slate-500 text-start p-2 w-full'>
                <button className='font-semibold hover:underline' value='AddSecurityDevice'>
                    <img src={KeyIcon} className="inline w-10 mr-1" alt='key icon' />
                    Add security device
                </button>
                <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>
                    Add a new security device to access your account. This can be a USB security token, Apple/Android device, etc. 
                </blockquote>
            </div>
        )
    });

    return <div>{list}</div>;
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
                console.debug("Compare idb %O to remote %O", userIdb, certificateRemoteVersions)
                let local_version = userIdb?.delegations_version || 0;
                if(local_version < certificateRemoteVersions.version) {
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
