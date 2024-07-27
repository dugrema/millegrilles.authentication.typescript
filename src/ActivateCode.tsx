import { useState, useCallback, useMemo, FormEventHandler } from 'react';
import { FileInput } from 'flowbite-react';
import useUserStore from './userStore';


type ActivateCodeProps = {
    back: any,
};

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

function ActivateCode(props: ActivateCodeProps) {

    const username = useUserStore(state=>state.username);

    let [uploadKey, setUploadKey] = useState(false);
    let [activationOk, setActivationOk] = useState(false);

    let upladKeyButtonHandler = useCallback(()=>setUploadKey(true), [setUploadKey]);

    let buttonAnotherHandler = useCallback(()=>setActivationOk(false), [setActivationOk]);

    let formSubmitHandler = useCallback((e: React.FormEvent<HTMLInputElement>)=>{
        e.preventDefault();
        e.stopPropagation();
        setActivationOk(true);
    }, [setActivationOk]) as FormEventHandler;

    if(uploadKey) return <UploadKey {...props} />;

    return (
        <div className={'grid grid-cols-1 justify-items-center'}>
            <p className='text-3xl font-bold text-slate-400 pb-10'>Activate a code</p>
            <p>This is for your {username} account.</p>

            <form onSubmit={formSubmitHandler}>
                <div className='MessageBox grid grid-cols-3 min-w-80 max-w-lg border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 justify-items-start'>
                    {activationOk?
                        <MessageBoxActivationOk {...props} buttonAnotherHandler={buttonAnotherHandler} />
                        :
                        <MessageBoxForm {...props} />
                    }
                </div>
            </form>

            <div className='pt-10'>
                <p>Use the following button if you have received a key in a .json file to upload.</p>
                <button onClick={upladKeyButtonHandler} className={CLASSNAME_BUTTON+'bg-slate-700 text-slate-300 '}>Upload key</button>
            </div>

        </div>
    );
}

export default ActivateCode;

function UploadKey(props: ActivateCodeProps) {

    const username = useUserStore(state=>state.username);
    
    let [password, setPassword] = useState('')
    let [invalidKey, setInvalidKey] = useState(false);
    let [installCertificate, setInstallCertificate] = useState(false);

    let formSubmitHandler = useCallback((e: React.FormEvent<HTMLInputElement>)=>{
        e.preventDefault();
        e.stopPropagation();
        if(password === 'bad') {
            setInvalidKey(true);
            return false;
        } else {
            setInvalidKey(false);
            setInstallCertificate(true);
        }
    }, [password, setInvalidKey, setInstallCertificate]) as FormEventHandler;

    let passwordChangeHandler = useCallback((e: React.FormEvent<HTMLInputElement>)=>{
        setPassword(e.currentTarget?e.currentTarget.value:'');
    }, [setPassword]) as FormEventHandler;

    let showInstall = !invalidKey && installCertificate;

    return (
        <div className={'grid grid-cols-1 justify-items-center'}>
            <p className='text-3xl font-bold text-slate-400 pb-10'>Upload a key</p>
            <p>This is for your {username} account.</p>

            <form onSubmit={formSubmitHandler}>
                <div className='flex flex-col MessageBox min-w-80 border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 text-start space-y-4'>
                    {showInstall?
                        <InstallCertificate {...props} />
                    :
                        <UploadKeyForm {...props} 
                            password={password} 
                            passwordChangeHandler={passwordChangeHandler} 
                            invalidKey={invalidKey} />
                    }
                    
                </div>
            </form>

        </div>        
    )
}

type UploadKeyFormProps = {
    back: any,
    password: string,
    invalidKey: boolean,
    passwordChangeHandler: FormEventHandler,
};

function UploadKeyForm(props: UploadKeyFormProps) {

    let invalidKey = props.invalidKey;

    let classnameMessageInvalid = useMemo(()=>{
        if(invalidKey) return '';
        return 'hidden';
    }, [invalidKey])

    return (
        <>
            <label htmlFor='password' className='min-w-full'>Password</label>
            <input 
                id='password' type='password' placeholder="The password if provided." autoComplete="off"
                value={props.password} onChange={props.passwordChangeHandler}
                className='w-80 bg-slate-700 text-slate-300 hover:bg-slate-500 hover:ring-offset-1 hover:ring-1 focus:bg-indigo-700' 
                />

            <label htmlFor='file-upload'>Key file upload</label>
            <FileInput id='file-upload' sizing='sm' className='w-full max-w-80 overflow-hidden' required accept='application/json'
                helperText='Supported format is .json' />

            <div className='flex min-w-full col-span-3 pt-6 justify-center'>
                <input type='submit' className={CLASSNAME_BUTTON+'bg-indigo-700 text-slate-300 '} value='Next' />
                <button onClick={props.back} className={CLASSNAME_BUTTON+'bg-slate-700 text-slate-300 '}>Cancel</button>
            </div>

            <div className={classnameMessageInvalid}>
                The key is invalid.
            </div>
        </>
    )
}

function InstallCertificate(props: ActivateCodeProps) {
    return (
        <div>
            <p className='max-w-64 pb-4'>The key is valid. Click on install to start using your new certificate.</p>
            <button onClick={props.back} className={CLASSNAME_BUTTON+'bg-indigo-700 text-slate-300 '}>Install</button>
            <button onClick={props.back} className={CLASSNAME_BUTTON+'bg-slate-700 text-slate-300 '}>Cancel</button>
        </div>
    )
}

type MessageBoxFormProps = {
    back: any,
    // buttonNextHandler: any,
};

function MessageBoxForm(props: MessageBoxFormProps) {
    return (
        <>
            <label htmlFor='username' className='justify-self-end pr-4'>Code</label>
            <input 
                id='username' type='text' placeholder="abcd-1234" autoComplete="off" required pattern='^[0-9a-f]{4}-?[0-9a-f]{4}$'
                className='w-28 col-span-2 bg-slate-700 text-slate-300 hover:bg-slate-500 hover:ring-offset-1 hover:ring-1 focus:bg-indigo-700 invalid:text-red-50 invalid:border-red-500' 
                />

            <div className='flex min-w-full col-span-3 mt-10 justify-center'>
                <input type='submit' className={CLASSNAME_BUTTON+'bg-indigo-700 text-slate-300 '} value='Next'/>
                <button onClick={props.back} className={CLASSNAME_BUTTON+'bg-slate-700 text-slate-300 '}>Cancel</button>
            </div>
        </>
    )
}

type MessageBoxActivationOkProps = {
    back: any,
    buttonAnotherHandler: any,
};

function MessageBoxActivationOk(props: MessageBoxActivationOkProps) {
    return (
        <>
            <p className='col-span-3 w-full'>Code activated successfully.</p>

            <div className='flex min-w-full col-span-3 mt-10 justify-center'>
                <button onClick={props.back} className={CLASSNAME_BUTTON+'bg-indigo-700 text-slate-300 '}>Done</button>
                <button onClick={props.buttonAnotherHandler} className={CLASSNAME_BUTTON+'bg-slate-700 text-slate-300 '}>Another code</button>
            </div>
        </>
    )
}
