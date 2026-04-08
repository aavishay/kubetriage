
import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Comment } from '../types';

interface CommentsThreadProps {
    reportID?: number;
    clusterID?: string;
    namespace?: string;
    workloadName?: string;
    isDarkMode?: boolean;
}

export const CommentsThread: React.FC<CommentsThreadProps> = ({
    reportID, clusterID, namespace, workloadName, isDarkMode
}) => {
    const user = {
        id: 'local-user',
        name: 'Local Admin',
        email: 'local@kubetriage',
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=local-user`
    };
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isPosting, setIsPosting] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        fetchComments();
    }, [reportID, clusterID, namespace, workloadName]);

    useEffect(() => {
        scrollToBottom();
    }, [comments]);

    const fetchComments = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (reportID) params.append('reportID', reportID.toString());
            if (clusterID) params.append('clusterID', clusterID);
            if (namespace) params.append('namespace', namespace);
            if (workloadName) params.append('workload', workloadName);

            const res = await fetch(`/api/comments?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setComments(data);
            }
        } catch (e) {
            console.error("Failed to load comments", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        setIsPosting(true);
        try {
            const res = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: newComment,
                    reportId: reportID,
                    clusterId: clusterID,
                    namespace: namespace,
                    workloadName: workloadName
                })
            });

            if (res.ok) {
                const created = await res.json();
                setComments([...comments, created]);
                setNewComment('');
            }
        } catch (e) {
            console.error("Failed to post comment", e);
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <div className={`flex flex-col h-full bg-bg-hover rounded-2xl border border-border-main overflow-hidden ${isDarkMode ? 'dark' : ''}`}>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar min-h-[200px] max-h-[400px]">
                {isLoading ? (
                    <div className="flex justify-center p-4">
                        <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
                    </div>
                ) : comments.length === 0 ? (
                    <div className="text-center py-8 text-text-tertiary text-xs italic">
                        No notes yet. Start a discussion...
                    </div>
                ) : (
                    comments.map(c => (
                        <div key={c.ID} className="group flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                            <div className="shrink-0 mt-0.5">
                                <img
                                    src={c.AuthorAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.Author || 'local-user'}`}
                                    className="w-6 h-6 rounded-full border border-border-main bg-bg-hover"
                                    alt="avatar"
                                />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-semibold text-text-secondary">{c.Author || 'Local Admin'}</span>
                                    <span className="text-[10px] text-text-tertiary">{new Date(c.CreatedAt).toLocaleString()}</span>
                                </div>
                                <div className="p-3 bg-bg-hover rounded-2xl text-xs text-text-secondary leading-relaxed break-words border border-border-main">
                                    {c.Content}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handlePost} className="p-3 border-t border-border-main bg-bg-hover">
                <div className="relative">
                    <input
                        type="text"
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Add private note..."
                        className="kt-input pr-12 py-2.5 text-xs"
                    />
                    <button
                        type="submit"
                        disabled={isPosting || !newComment.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 kt-button kt-button-primary p-1.5 disabled:opacity-50"
                    >
                        {isPosting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </form>
        </div>
    );
};
