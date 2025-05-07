import { auth, db } from '@/config/firebase';
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    User
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { createContext, FC, PropsWithChildren, useContext, useEffect, useState } from 'react';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean | undefined;
    login: (email: string, password: string) => Promise<any>;
    logout: () => Promise<any>;
    register: (email: string, password: string, username: string, profileUrl: string) => Promise<any>;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
    user: null,
    isAuthenticated: undefined,
    login: async () => ({ success: false }),
    logout: async () => ({ success: false }),
    register: async () => ({ success: false }),
});

export const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | undefined>(undefined);

    useEffect(() => {
        const unSubscriber = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUser(user);
                setIsAuthenticated(true);
                updateUserData(user.uid);
            } else {
                setUser(null);
                setIsAuthenticated(false);
            }
        });

        return unSubscriber;
    }, []);

    const updateUserData = async (userId: string) => {
        const docRef = doc(db, 'users', userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // Update user data if needed
            setUser((prev) => {
                if (!prev) return null;
                return {
                    ...prev,
                    // Add any custom fields from Firestore if needed
                };
            });
        }
    };

    const login = async (email: string, password: string) => {
        try {
            const response = await signInWithEmailAndPassword(auth, email, password);
            return { data: response?.user, success: true };
        } catch (error: any) {
            let msg = error.message;
            if (msg.includes('(auth/invalid-email)')) {
                msg = 'Invalid email';
            }
            if (msg.includes('(auth/invalid-credential)')) {
                msg = 'Invalid credential';
            }

            return { msg, success: false };
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            return { success: true };
        } catch (error: any) {
            return { error, msg: error.message, success: false };
        }
    };

    const register = async (email: string, password: string, username: string, profileUrl: string) => {
        try {
            const response = await createUserWithEmailAndPassword(auth, email, password);

            await setDoc(doc(db, 'users', response?.user?.uid), {
                username,
                profileUrl,
                userId: response?.user?.uid,
                createdAt: new Date().toISOString(),
                email
            });

            return { data: response?.user, success: true };
        } catch (error: any) {
            let msg = error.message;
            if (msg.includes('(auth/invalid-email)')) {
                msg = 'Invalid email';
            }
            if (msg.includes('(auth/email-already-in-use)')) {
                msg = 'Email already in use';
            }

            return { msg, success: false };
        }
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, login, logout, register }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const value = useContext(AuthContext);

    if (!value) {
        throw new Error('useAuth must be wrapped inside AuthProvider');
    }

    return { ...value };
};
