import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ConnectionStoreState {
    username: string,
    userId: string,
    workersReady: boolean,
    connectionReady: boolean,
    signatureReady: boolean,
    setUsername: (newUsername: string) => void,
    setWorkersReady: (ready: boolean) => void,
    setConnectionReady: (ready: boolean) => void,
    setSignatureReady: (ready: boolean) => void,
};

const useConnectionStore = create<ConnectionStoreState>()(
    devtools(
        (set) => ({
            username: '',
            userId: '',
            workersReady: false,
            connectionReady: false,
            signatureReady: false,
            setUsername: (newUsername) => set(() => ({ username: newUsername })),
            setWorkersReady: (ready) => set(() => ({ workersReady: ready })),
            setConnectionReady: (ready) => set(() => ({ connectionReady: ready })),
            setSignatureReady: (ready) => set(() => ({ signatureReady: ready })),
        })
    ),
);

export default useConnectionStore;
