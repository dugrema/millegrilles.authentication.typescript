import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface UserStoreState {
    username: string,
    setUsername: (newUsername: string) => void,
};

const useUserStore = create<UserStoreState>()(
    devtools(
        (set) => ({
            username: '',
            setUsername: (newUsername) => set((state) => ({ username: newUsername })),
        })
    ),
);

export default useUserStore;
