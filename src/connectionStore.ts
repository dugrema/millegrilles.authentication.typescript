import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ConnectionStoreState {
    idmg: string,
    ca: string,
    chiffrage: Array<Array<string>> | null,
    username: string,
    userId: string,
    workersReady: boolean,
    connectionReady: boolean,
    signatureReady: boolean,
    setFiche: (idmg: string, ca: string, chiffrage: Array<Array<string>>) => void,
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
            chiffrage: null,
            username: '',
            userId: '',
            workersReady: false,
            connectionReady: false,
            signatureReady: false,
            setFiche: (idmg, ca, chiffrage) => set(() => ({ idmg, ca, chiffrage })),
            setUsername: (newUsername) => set(() => ({ username: newUsername })),
            setWorkersReady: (ready) => set(() => ({ workersReady: ready })),
            setConnectionReady: (ready) => set(() => ({ connectionReady: ready })),
            setSignatureReady: (ready) => set(() => ({ signatureReady: ready })),
        })
    ),
);

export default useConnectionStore;
