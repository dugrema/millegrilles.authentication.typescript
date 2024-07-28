import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ConnectionStoreState {
    idmg: string,
    ca: string,
    chiffrage: Array<Array<string>> | null,
    username: string,
    userId: string,
    workersReady: boolean,
    workersRetry: {retry: boolean, count: number},
    connectionReady: boolean,
    signatureReady: boolean,
    setFiche: (idmg: string, ca: string, chiffrage: Array<Array<string>>) => void,
    setUsername: (newUsername: string) => void,
    setUserId: (userId: string) => void,
    setWorkersReady: (ready: boolean) => void,
    setConnectionReady: (ready: boolean) => void,
    setSignatureReady: (ready: boolean) => void,
    incrementWorkersRetry: () => void,
    setWorkersRetryReady: () => void,
};

const useConnectionStore = create<ConnectionStoreState>()(
    devtools(
        (set) => ({
            idmg: '',
            ca: '',
            chiffrage: null,
            username: '',
            userId: '',
            workersReady: false,
            workersRetry: {retry: true, count: 0},
            connectionReady: false,
            signatureReady: false,
            setFiche: (idmg, ca, chiffrage) => set(() => ({ idmg, ca, chiffrage })),
            setUsername: (username) => set(() => ({ username })),
            setUserId: (userId) => set(() => ({ userId })),
            setWorkersReady: (ready) => set(() => ({ workersReady: ready })),
            setConnectionReady: (ready) => set(() => ({ connectionReady: ready })),
            setSignatureReady: (ready) => set(() => ({ signatureReady: ready })),
            incrementWorkersRetry: () => set((state) => ({ workersRetry: {retry: false, count: state.workersRetry.count+1 } })),
            setWorkersRetryReady: () => set((state) => ({ workersRetry: {retry: true, count: state.workersRetry.count } })),
        })
    ),
);

export default useConnectionStore;
