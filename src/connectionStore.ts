import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ConnectionStoreState {
    idmg: string,
    ca: string,
    username: string,
    userId: string,
    workersReady: boolean,
    connectionReady: boolean,
    signatureReady: boolean,
    setIdmg: (idmg: string) => void,
    setCa: (ca: string) => void,
    setUsername: (newUsername: string) => void,
    setWorkersReady: (ready: boolean) => void,
    setConnectionReady: (ready: boolean) => void,
    setSignatureReady: (ready: boolean) => void,
};

const useConnectionStore = create<ConnectionStoreState>()(
    devtools(
        (set) => ({
            idmg: '',
            ca: '',
            username: '',
            userId: '',
            workersReady: false,
            connectionReady: false,
            signatureReady: false,
            setIdmg: (idmg) => set(() => ({ idmg })),
            setCa: (ca) => set(() => ({ ca })),
            setUsername: (newUsername) => set(() => ({ username: newUsername })),
            setWorkersReady: (ready) => set(() => ({ workersReady: ready })),
            setConnectionReady: (ready) => set(() => ({ connectionReady: ready })),
            setSignatureReady: (ready) => set(() => ({ signatureReady: ready })),
        })
    ),
);

export default useConnectionStore;
