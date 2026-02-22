import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Wifi, WifiOff, XCircle, Play, Pause, Download, ChevronDown } from 'lucide-react';

interface LogStreamViewerProps {
    clusterId: string;
    namespace: string;
    podNames: string[];
    container?: string;
    onClose?: () => void;
}

export const LogStreamViewer: React.FC<LogStreamViewerProps> = ({ clusterId, namespace, podNames, container, onClose }) => {
    const [selectedPod, setSelectedPod] = useState<string>(podNames[0] || '');
    const [logs, setLogs] = useState<string[]>([]);
    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [isPaused, setIsPaused] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);

    const wsRef = useRef<WebSocket | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Update selected pod if podNames changes and current selection is invalid
    useEffect(() => {
        if (podNames.length > 0 && !podNames.includes(selectedPod)) {
            setSelectedPod(podNames[0]);
        }
    }, [podNames, selectedPod]);

    useEffect(() => {
        if (!selectedPod || !namespace) return;

        // Close existing
        if (wsRef.current) {
            wsRef.current.close();
        }

        setLogs([]);
        setStatus('connecting');
        setErrorMsg('');
        setIsPaused(false);

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const url = `${protocol}//${host}/api/ws/logs?clusterId=${clusterId}&namespace=${namespace}&podName=${selectedPod}${container ? `&container=${container}` : ''}`;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setStatus('connected');
        };

        ws.onmessage = (event) => {
            if (isPaused) return;
            const message = event.data;
            setLogs(prev => {
                const newLogs = [...prev, message];
                // Keep limited history to prevent memory issues
                if (newLogs.length > 5000) {
                    return newLogs.slice(newLogs.length - 5000);
                }
                return newLogs;
            });
        };

        ws.onerror = (e) => {
            console.error("WebSocket Error", e);
            setStatus('error');
            setErrorMsg('Connection failed');
        };

        ws.onclose = (e) => {
            if (status !== 'error') {
                setStatus('disconnected');
            }
        };

        return () => {
            ws.close();
        };
    }, [namespace, selectedPod, container]);

    // Auto-scroll logic
    useEffect(() => {
        if (autoScroll && scrollRef.current && !isPaused) {
            const { scrollHeight, clientHeight } = scrollRef.current;
            scrollRef.current.scrollTo({
                top: scrollHeight - clientHeight,
                behavior: 'smooth'
            });
        }
    }, [logs, autoScroll, isPaused]);

    // Handle manual scroll to disable auto-scroll
    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
            setAutoScroll(isAtBottom);
        }
    };

    const downloadLogs = () => {
        const element = document.createElement("a");
        const file = new Blob([logs.join('\n')], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = `${selectedPod}-logs.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    return (
        <div className="flex flex-col h-full bg-black/90 rounded-3xl overflow-hidden border border-white/10 shadow-2xl font-mono text-xs">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 ${status === 'connected' ? 'text-emerald-400' : status === 'connecting' ? 'text-amber-400' : 'text-rose-400'}`}>
                        {status === 'connected' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                        <span className="uppercase font-bold tracking-wider">{status}</span>
                    </div>

                    <div className="h-4 w-px bg-white/10 mx-2" />

                    {/* Pod Selector */}
                    <div className="relative group">
                        <select
                            value={selectedPod}
                            onChange={(e) => setSelectedPod(e.target.value)}
                            className="bg-transparent text-gray-300 font-bold focus:outline-none appearance-none pr-6 cursor-pointer hover:text-white transition-colors"
                        >
                            {podNames.map(p => (
                                <option key={p} value={p} className="bg-zinc-900">{p}</option>
                            ))}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className={`p-2 rounded-lg transition-colors ${isPaused ? 'bg-amber-500/20 text-amber-500' : 'hover:bg-white/10 text-gray-400'}`}
                        title={isPaused ? "Resume Streaming" : "Pause Streaming"}
                    >
                        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>

                    <button
                        onClick={downloadLogs}
                        className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="Download Logs"
                    >
                        <Download className="w-4 h-4" />
                    </button>

                    {onClose && (
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-rose-500/20 text-gray-400 hover:text-rose-500 transition-colors ml-2">
                            <XCircle className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Logs Area */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-auto p-4 space-y-1 custom-scrollbar scroll-smooth"
            >
                {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-4">
                        {status === 'connecting' ? (
                            <>
                                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                                <p>Establishing Secure Uplink...</p>
                            </>
                        ) : status === 'error' ? (
                            <div className="text-center">
                                <p className="text-rose-500 font-bold mb-2">Connection Error</p>
                                <p className="opacity-50">{errorMsg}</p>
                            </div>
                        ) : (
                            <p>Waiting for incoming telemetry stream...</p>
                        )}
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="hover:bg-white/5 px-2 py-0.5 rounded break-all whitespace-pre-wrap flex gap-3 group">
                            <span className="text-gray-600 select-none w-8 text-right shrink-0 opacity-20">{i + 1}</span>
                            <span className={
                                log.includes('ERROR') || log.includes('Error') ? 'text-rose-400' :
                                    log.includes('WARN') || log.includes('Warning') ? 'text-amber-400' :
                                        log.includes('INFO') ? 'text-blue-300' :
                                            'text-gray-300'
                            }>
                                {log}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {/* Status Bar */}
            <div className="px-4 py-1.5 bg-black text-[10px] text-gray-600 flex justify-between border-t border-white/5">
                <span>{logs.length} lines buffered</span>
                <span>Autoscroll: {autoScroll ? 'ON' : 'OFF'}</span>
            </div>
        </div>
    );
};
