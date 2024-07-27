import { FormEventHandler, useCallback } from 'react';
import useUserStore from './userStore';

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

type AddSecurityDeviceProps = {
    back: any,
};

function AddSecurityDevice(props: AddSecurityDeviceProps) {

    const username = useUserStore(state=>state.username);

    const formSubmitHandler = useCallback((e: React.FormEvent<HTMLInputElement>)=>{
        e.preventDefault();
        e.stopPropagation();

    }, []) as FormEventHandler;

    return (
        <div>
            <div className={'grid grid-cols-1 justify-items-center'}>
                <p className='text-3xl font-bold text-slate-400 pb-10'>Add a security device</p>
                <p>This is for your {username} account.</p>

                <form onSubmit={formSubmitHandler}>
                    <div className='MessageBox min-w-80 border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 text-start space-y-4'>
                        
                        <div>
                            <input 
                                id='deactivate-other-keys' type='checkbox' placeholder="The password if provided." autoComplete="off" required
                                className='bg-slate-700 checked:bg-slate-700 mr-2' 
                                />
                            <label htmlFor='deactivate-other-keys' className='col-span-2'>Also remove <span className='font-semibold'>all other</span> security devices for this account.</label>
                        </div>

                        <div className='flex min-w-full col-span-3 pt-6 justify-center'>
                            <button onClick={props.back} className={CLASSNAME_BUTTON+'bg-indigo-700 text-slate-300 '}>Next</button>
                            <button onClick={props.back} className={CLASSNAME_BUTTON+'bg-slate-700 text-slate-300 '}>Cancel</button>
                        </div>
                    </div>
                </form>

            </div>        
        </div>
    );
}

export default AddSecurityDevice;
