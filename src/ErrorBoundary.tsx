import { Component } from 'react'

const CLASSNAME_BUTTON = `
    transition ease-in-out 
    min-w-40 
    rounded 
    bg-slate-700 text-slate-300 
    font-bold
    hover:bg-slate-500 
    active:bg-indigo-700
    disabled:bg-slate-900 disabled:text-slate-600 disabled:ring-offset-0 disabled:ring-0
    hover:ring-offset-1 hover:ring-1
    p-1 m-1
`;

class ErrorBoundary extends Component {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false };
    }
  
    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }
  
    componentDidCatch(error: any, errorInfo: any) {
        // Transfert the error code to state
        let errorCode = error.code;
        this.setState({...this.state, errorCode});
    }
  
    render() {
        // @ts-ignore
        if(this.state.hasError) {
            return (
                <div className="App">
                    <header className="App-header text-slate-300 flex-1 content-center loading">
                        <h1 style={{'paddingTop': '1.5rem', 'paddingBottom': '1.7rem'}}>MilleGrilles</h1>
                        <p>An error occurred. The page cannot be loaded a this time.</p>
                        <button className={CLASSNAME_BUTTON} onClick={reload}>Retry</button>
                        <div style={{height: '20vh'}}></div>
                    </header>
                </div>
            )
        }
        // @ts-ignore
        return this.props.children;
    }
}

export default ErrorBoundary

function reload() {
    window.location.reload()
}
