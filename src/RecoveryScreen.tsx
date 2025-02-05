import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { proxy } from 'comlink';
import { messageStruct } from "millegrilles.cryptography";

// import { MessageResponse, SubscriptionMessage } from "./workers/";
import { MessageResponse, SubscriptionMessage } from "millegrilles.reactdeps.typescript";
import useWorkers from "./workers/workers";
import useConnectionStore from "./connectionStore";
import useAuthenticationStore from "./authenticationStore";
import { getUser, receiveCertificate } from "./idb/userStoreIdb";
import { authenticateConnectionWorker, createCertificateRequest, performLogin } from "./Login";

type RecoveryScreenProps = {
    username: string,
    back(): void,
    sessionDuration: number,
}

type ActivationMessage = (MessageResponse | messageStruct.MilleGrillesMessage) & {
    certificat?: Array<string>,
    fingerprint_pk?: string,
};

export default function RecoveryScreen(props: RecoveryScreenProps) {

    let { t } = useTranslation();
    let workers = useWorkers();
    let username = props.username;
    let back = props.back;
    let sessionDuration = props.sessionDuration;

    let connectionReady = useConnectionStore((state) => state.connectionReady);
    let setMustManuallyAuthenticate = useConnectionStore((state) => state.setMustManuallyAuthenticate);
    let setConnectionAuthenticated = useConnectionStore((state) => state.setConnectionAuthenticated);
    let setUsernameStore = useConnectionStore( state => state.setUsername );
    let setUsernamePersist = useAuthenticationStore( state => state.setUsername );
    let setSessionDurationPersist = useAuthenticationStore( state => state.setSessionDuration );

    let [publicKey, setPublicKey] = useState<string>('');
    let [activationCode, setActivationCode] = useState<string>('');

    let receiveConfirmationCallback = useMemo(()=>proxy(async (event: SubscriptionMessage) => {
        let activation = event.message as ActivationMessage;
        if(activation.certificat && activation.fingerprint_pk) {
            let userIdb = await getUser(username);
            if(!userIdb) {
                throw new Error("Uknown user " + username);
            }
            let certificateRequest = userIdb.request;
            if(!certificateRequest || certificateRequest.publicKeyString !== activation.fingerprint_pk) {
                throw new Error("Mismatch between local request and new certificate");
            }
            let certificate = activation.certificat;
            await receiveCertificate(username, certificate);

            // Ready, log the user in
            if(workers) {
                setUsernameStore(username);

                // Activate the server session
                await performLogin(workers, username, sessionDuration);
                
                // Authenticate the connection worker
                await authenticateConnectionWorker(workers, username, true);

                setMustManuallyAuthenticate(false);
                setConnectionAuthenticated(true);

                // Persist information for next time the screen is loaded
                setUsernamePersist(username);
                setSessionDurationPersist(sessionDuration);

            } else {
                console.warn("Workers not initialized");
                back();
            }
        }
    }), [workers, username, sessionDuration, back, setUsernameStore, setMustManuallyAuthenticate, setConnectionAuthenticated, setUsernamePersist, setSessionDurationPersist]);

    useEffect(()=>{
        if(!workers || !connectionReady || !activationCode) return;  // Not ready
        workers.connection.subscribeActivationCode(receiveConfirmationCallback, publicKey)
            .catch(err=>console.error("Error subscribing for activation code", err));
        return () => {
            workers?.connection.unsubscribeActivationCode(receiveConfirmationCallback, publicKey)
                .catch(err=>console.error("Error subscribing for activation code", err));
        }
    }, [workers, publicKey, connectionReady, activationCode, receiveConfirmationCallback])

    useEffect(()=>{
        getUser(username)
            .then(async userIdb => {
                let entry;
                if(!workers) throw new Error("Workers not intialized");
                if(!userIdb?.request) {
                    // Generate new CSR
                    entry = await createCertificateRequest(workers, username);
                } else {
                    entry = userIdb.request;
                }
                let code = entry.publicKeyString.slice(entry.publicKeyString.length-8);
                let formattedCode = code.slice(0,4) + '-' + code.slice(4);
                let addRecoveryResult = await workers.connection.addRecoveryCsr(username, entry.pem);
                if(!addRecoveryResult.ok) throw new Error(`Error adding recovery code: ${addRecoveryResult.err}"`);

                // Set values
                setPublicKey(entry.publicKeyString);
                setActivationCode(formattedCode);
            })
            .catch(err=>console.error("Error adding recovery code for user %s: %O", username, err));
    }, [workers, username, setPublicKey, setActivationCode])

    return (
        <div className='MessageBox grid grid-cols-3 mx-2 min-w-80 max-w-lg border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 justify-items-end'>

            <p className='col-span-3 text-left mb-4 min-w-full'>{t('screens.recovery.instructions1', {username})}</p>
            <p className='col-span-3 text-left mb-4 min-w-full'>{t('screens.recovery.instructions2')}</p>

            <p className='text-left'>{t('labels.activationCode')}</p>
            <p className='col-span-2 text-left'>{activationCode}</p>

            <p className='col-span-3 text-left mt-4 mb-4 min-w-full'>{t('screens.recovery.instructions3')}</p>

            <div className='flex min-w-full col-span-3 justify-center mt-10'>
                <button onClick={props.back}
                    className='btn bg-indigo-800 hover:bg-indigo-600 active:bg-indigo-500' >
                        {t('buttons.cancel')}
                </button>
            </div>

        </div>
    )
}
