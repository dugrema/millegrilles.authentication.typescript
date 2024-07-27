import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface UserStoreState {
    username: string,
    language: string,
    setUsername: (newUsername: string) => void,
    setLanguage: (newLanguage: string) => void,
};

const useUserStore = create<UserStoreState>()(
    devtools(
        (set) => ({
            username: '',
            language: 'en',
            setUsername: (newUsername) => set((state) => ({ username: newUsername })),
            setLanguage: (newLanguage) => set((state) => ({ language: newLanguage })),
        })
    ),
);

export default useUserStore;
