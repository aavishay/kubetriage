
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

interface PresenceEvent {
    type: 'join' | 'leave' | 'view' | 'log_state';
    userId: string;
    userName: string;
    avatarUrl: string;
    targetId: string;
    timestamp: number;
    payload?: any;
}

export interface LogStatePayload {
    searchTerm: string;
    isWrapEnabled: boolean;
}

interface PresenceContextType {
    activeUsers: Record<string, PresenceEvent[]>; // targetId -> users
    notifyView: (targetId: string) => void;
    notifyLeave: (targetId: string) => void;
    broadcastLogState: (targetId: string, state: LogStatePayload) => void;
    logStateEvents: Record<string, PresenceEvent>; // targetId -> last log state event
}

const PresenceContext = createContext<PresenceContextType>({
    activeUsers: {},
    notifyView: () => { },
    notifyLeave: () => { },
    broadcastLogState: () => { },
    logStateEvents: {},
});

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [activeUsers, setActiveUsers] = useState<Record<string, PresenceEvent[]>>({});
    const [logStateEvents, setLogStateEvents] = useState<Record<string, PresenceEvent>>({});
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!user) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const ws = new WebSocket(`${protocol}//${host}/ws/presence`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            const data: PresenceEvent = JSON.parse(event.data);
            setActiveUsers(prev => {
                const newState = { ...prev };

                if (data.type === 'view') {
                    if (!newState[data.targetId]) newState[data.targetId] = [];
                    // Remove if already exists to update timestamp
                    newState[data.targetId] = newState[data.targetId].filter(u => u.userId !== data.userId);
                    newState[data.targetId].push(data);
                } else if (data.type === 'leave') {
                    if (newState[data.targetId]) {
                        newState[data.targetId] = newState[data.targetId].filter(u => u.userId !== data.userId);
                        if (newState[data.targetId].length === 0) delete newState[data.targetId];
                    }
                } else if (data.type === 'log_state') {
                    // Handle log state without mutating activeUsers structure, but store separately
                    setLogStateEvents(prevLogs => ({
                        ...prevLogs,
                        [data.targetId]: data
                    }));
                }
                return newState;
            });
        };

        return () => {
            ws.close();
        };
    }, [user]);

    const notifyView = (targetId: string) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && user) {
            wsRef.current.send(JSON.stringify({
                type: 'view',
                userId: user.id,
                userName: user.name || user.email.split('@')[0], // Fallback
                avatarUrl: user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`, // Fallback
                targetId: targetId
            }));
        }
    };

    const notifyLeave = (targetId: string) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && user) {
            wsRef.current.send(JSON.stringify({
                type: 'leave',
                userId: user.id,
                userName: user.name || user.email.split('@')[0],
                avatarUrl: user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
                targetId: targetId
            }));
        }
    };

    const broadcastLogState = (targetId: string, state: LogStatePayload) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && user) {
            wsRef.current.send(JSON.stringify({
                type: 'log_state',
                userId: user.id,
                userName: user.name || user.email.split('@')[0],
                avatarUrl: user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
                targetId: targetId,
                payload: state
            }));
        }
    };

    return (
        <PresenceContext.Provider value={{ activeUsers, notifyView, notifyLeave, broadcastLogState, logStateEvents }}>
            {children}
        </PresenceContext.Provider>
    );
};

export const usePresence = () => useContext(PresenceContext);
