import { Component } from 'react'

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
                        <button onClick={reload}
                            className='btn bg-indigo-800 hover:bg-indigo-600 active:bg-indigo-500'>
                                Retry
                        </button>
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
