import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AuthenticationStoreState {
    username: string,
    sessionDuration: number,
    setUsername: (username: string) => void,
    setSessionDuration: (duration: number) => void,
};

/**
 * Store that persists values in local storage for the Login page.
 */
const useAuthenticationStore = create<AuthenticationStoreState>()(
    devtools(
        persist(
            (set) => ({
                username: '',
                sessionDuration: 86400,
                setUsername: (username) => set(() => ({ username })),
                setSessionDuration: (sessionDuration) => set(() => ({ sessionDuration })),
            }),
            { name: 'authentication-storage' }
        )
    ),
);

export default useAuthenticationStore;
