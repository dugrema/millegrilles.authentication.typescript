import {useCallback, MouseEvent, MouseEventHandler, Dispatch, SyntheticEvent} from 'react';
import { Popover } from 'flowbite-react';
import { LanguageSelectbox } from './Login';
import KeyIcon from './resources/key-svgrepo-com.svg';
import SwitchIcon from './resources/switch-svgrepo-com.svg';
// import ForwardIcon from './resources/forward-svgrepo-com.svg';
// import SetUpIcon from './resources/set-up-svgrepo-com.svg';
import VersionInfo from './VersionInfo';

type ApplicationListProps = {
    username: string,
    logout: MouseEventHandler<MouseEvent>,
    setPage: Dispatch<string>,
};

function ApplicationList(props: ApplicationListProps) {

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
                <LanguagePopover /> {props.username}.
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
                <div className='border rounded-b-lg border-slate-500 text-start p-2 w-full'>
                    <button className='hover:underline font-semibold' onClick={logoutClickHandler}>
                        <img src={SwitchIcon} className="inline w-10 mr-1" alt='swtich icon' />
                        Logout
                    </button>
                    <blockquote className='text-left h-18 line-clamp-6 sm:line-clamp-3 text-sm'>Close session and clear secrets.</blockquote>
                </div>
            </div>
            <VersionInfo />
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
