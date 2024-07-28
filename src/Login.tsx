import {Dispatch, useState, useMemo, useCallback} from 'react';
import LanguageIcon from './resources/language-svgrepo-com.svg';
import VersionInfo from './VersionInfo';
import useUserStore from './connectionStore';

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

type LoginProps = {
    // setUsername: Dispatch<string>,
};

function Login(props: LoginProps) {

    // let {setUsername: setUsernameProps} = props;
    const setUsernameTop = useUserStore(state=>state.setUsername);

    let [username, setUsername] = useState('dummy');
    let [error, setError] = useState('');
    let [mainOpacity, setMainOpacity] = useState('opacity-100');

    let handleLogin = useCallback((e: React.FormEvent<HTMLInputElement|HTMLFormElement>)=>{
        e.preventDefault();
        e.stopPropagation();

        if(!username) {
            setError('Username cannot be empty');
            return;
        }
        
        console.debug("Login user %s", username);
        setMainOpacity('opacity-0');
        setTimeout(()=>{
            setUsernameTop(username);
        }, 1000);
        
    }, [username, setMainOpacity, setUsernameTop]);

    let usernameOnChangeHandler = useCallback((e: React.FormEvent<HTMLInputElement>) => {
        setError('');
        setUsername(e.currentTarget.value);
    }, [setUsername, setError])

    return (
        <div className={'transition-opacity duration-1000 grid grid-cols-1 justify-items-center ' + mainOpacity}>
            <h1 className='text-3xl font-bold text-slate-400'>MilleGrilles</h1>
            <form>
                <div className='MessageBox grid grid-cols-3 min-w-80 max-w-lg border-4 border-slate-500 shadow-2xl rounded-xl p-8 bg-slate-900 text-slate-300 justify-items-end'>
                    <UserSelection username={username} usernameOnChangeHandler={usernameOnChangeHandler} />
                    <LanguageSelectbox />
                    <DurationSelectbox />
                    
                    <div className='grid grid-cols-1 min-w-full col-span-3 justify-items-center mt-10'>
                        <Buttons handleLogin={handleLogin} />
                    </div>
                </div>
            </form>
            <Message error={error} setError={setError} />
            <VersionInfo />
        </div>
    );
}

export default Login;

type UserSelectionProps = {
    username: string,
    usernameOnChangeHandler: any
};

function UserSelection(props: UserSelectionProps) {
    return (
        <>
            <label htmlFor='username' className='pr-4'>Username</label>
            <input 
                id='username' type='text' list='usernames' autoComplete="off"
                className='min-w-full col-span-2 bg-slate-700 text-slate-300 hover:bg-slate-500 hover:ring-offset-1 hover:ring-1 focus:bg-indigo-700' 
                value={props.username} onChange={props.usernameOnChangeHandler}
                />
            <datalist id='usernames'>
                <option>Test</option>
                <option>TestA</option>
                <option>UserB</option>
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
