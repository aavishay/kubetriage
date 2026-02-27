
import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Comment } from '../types';

interface CommentsThreadProps {
    reportID?: number;
    clusterID?: string;
    namespace?: string;
    workloadName?: string;
    isDarkMode?: boolean;
}

export const CommentsThread: React.FC<CommentsThreadProps> = ({
    reportID, clusterID, namespace, workloadName, isDarkMode = true
}) => {
    const { user } = useAuth();
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
        <div className={`flex flex-col h-full bg-black/20 rounded-2xl border border-white/5 overflow-hidden ${isDarkMode ? 'dark' : ''}`}>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar min-h-[200px] max-h-[400px]">
                {isLoading ? (
                    <div className="flex justify-center p-4">
                        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                    </div>
                ) : comments.length === 0 ? (
                    <div className="text-center py-8 text-zinc-600 text-xs italic">
                        No notes yet. Start a discussion...
                    </div>
                ) : (
                    comments.map(c => (
                        <div key={c.ID} className="group flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                            <div className="shrink-0 mt-0.5">
                                <img
                                    src={c.User?.AvatarURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.UserID}`}
                                    className="w-6 h-6 rounded-full border border-white/10 bg-zinc-800"
                                    alt="avatar"
                                />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-zinc-300">{c.User?.Email?.split('@')[0] || 'Unknown'}</span>
                                    <span className="text-[9px] text-zinc-600">{new Date(c.CreatedAt).toLocaleString()}</span>
                                </div>
                                <div className="p-3 bg-white/5 rounded-r-xl rounded-bl-xl text-xs text-zinc-300 leading-relaxed break-words border border-white/5">
                                    {c.Content}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handlePost} className="p-3 border-t border-white/5 bg-white/5">
                <div className="relative">
                    <input
                        type="text"
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Add private note..."
                        className="w-full bg-black/20 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary-500/50 transition-all"
                    />
                    <button
                        type="submit"
                        disabled={isPosting || !newComment.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary-600 hover:bg-primary-500 rounded-lg text-white disabled:opacity-50 disabled:bg-zinc-700 transition-all"
                    >
                        {isPosting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </form>
        </div>
    );
};
