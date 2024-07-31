import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ConnectionStoreState {
    idmg: string,
    ca: string,
    chiffrage: Array<Array<string>> | null,
    userSessionActive: boolean,
    username: string,
    workersReady: boolean,
    workersRetry: {retry: boolean, count: number},
    connectionReady: boolean,
    signatureReady: boolean,
    connectionAuthenticated: boolean,
    mustManuallyAuthenticate: boolean,
    setFiche: (idmg: string, ca: string, chiffrage: Array<Array<string>>) => void,
    setUserSessionActive: (userSessionActive: boolean) => void,
    setUsername: (newUsername: string) => void,
    setWorkersReady: (ready: boolean) => void,
    setConnectionReady: (ready: boolean) => void,
    setSignatureReady: (ready: boolean) => void,
    incrementWorkersRetry: () => void,
    setWorkersRetryReady: () => void,
    setConnectionAuthenticated: (connectionAuthenticated: boolean) => void,
    setMustManuallyAuthenticate: (mustManuallyAuthenticate: boolean) => void,
};

const useConnectionStore = create<ConnectionStoreState>()(
    devtools(
        (set) => ({
            idmg: '',
            ca: '',
            chiffrage: null,
            userSessionActive: false,
            username: '',
            workersReady: false,
            workersRetry: {retry: true, count: 0},
            connectionReady: false,
            signatureReady: false,
            connectionAuthenticated: false,
            mustManuallyAuthenticate: false,
            setFiche: (idmg, ca, chiffrage) => set(() => ({ idmg, ca, chiffrage })),
            setUsername: (username) => set(() => ({ username })),
            setUserSessionActive: (userSessionActive) => set(() => ({ userSessionActive })),
            setWorkersReady: (ready) => set(() => ({ workersReady: ready })),
            setConnectionReady: (ready) => set(() => ({ connectionReady: ready })),
            setSignatureReady: (ready) => set(() => ({ signatureReady: ready })),
            incrementWorkersRetry: () => set((state) => ({ workersRetry: {retry: false, count: state.workersRetry.count+1 } })),
            setWorkersRetryReady: () => set((state) => ({ workersRetry: {retry: true, count: state.workersRetry.count } })),
            setConnectionAuthenticated: (connectionAuthenticated) => set(() => ({ connectionAuthenticated })),
            setMustManuallyAuthenticate: (mustManuallyAuthenticate) => set(() => ({ mustManuallyAuthenticate })),
        })
    ),
);

export default useConnectionStore;
