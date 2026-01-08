import React, { createContext, useContext, useEffect, useState } from 'react';

// User type definition
export interface User {
    id: string;
    email: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const login = async (email: string, password: string) => {
        // In a real app, we'd validating inputs here or calling a pre-login API
        // For OIDC, we just redirect. The email/password args are vestigial from the mock form
        // or could be used for a separate "Email/Password" flow if we kept it.

        // Redirect to Backend OIDC Start
        window.location.href = "http://localhost:3001/api/auth/login/google";
    };

    useEffect(() => {
        // In dev, we assume the backend AuthMiddleware will automatically
        // log us in as the "mock admin".
        fetch('/api/me')
            .then((res) => {
                if (res.ok) {
                    return res.json();
                }
                throw new Error('Not authenticated');
            })
            .then((data) => {
                setUser(data);
            })
            .catch((err) => {
                console.warn('Auth check failed:', err);
                setUser(null);
            })
            .finally(() => setIsLoading(false));
    }, []);

    const value = {
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const fetchWithAuth = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Wrapper for fetch that could handle token injection if we moved away from cookies
    return fetch(input, init);
};
