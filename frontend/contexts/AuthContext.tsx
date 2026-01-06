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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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
