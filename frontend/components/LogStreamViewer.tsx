import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Wifi, WifiOff, XCircle, Play, Pause, Download, ChevronDown } from 'lucide-react';
import { useMonitoring } from '../contexts/MonitoringContext';

interface LogStreamViewerProps {
    clusterId: string;
    namespace: string;
    podNames: string[];
    container?: string;
    onClose?: () => void;
}

export const LogStreamViewer: React.FC<LogStreamViewerProps> = ({ clusterId, namespace, podNames, container, onClose }) => {
    const { isDarkMode } = useMonitoring();
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
        <div className="flex flex-col h-full bg-bg-card rounded-[2rem] overflow-hidden border border-border-main shadow-2xl font-mono text-xs animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-bg-hover/30 border-b border-border-main">
                <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2.5 ${status === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : status === 'connecting' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {status === 'connected' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                        <span className="uppercase font-black tracking-widest text-xs">{status}</span>
                    </div>

                    <div className="h-5 w-px bg-border-main mx-2" />

                    {/* Pod Selector */}
                    <div className="relative group/pod">
                        <select
                            value={selectedPod}
                            onChange={(e) => setSelectedPod(e.target.value)}
                            className="kt-input appearance-none pr-7 cursor-pointer uppercase font-bold text-xs"
                        >
                            {podNames.map(p => (
                                <option key={p} value={p} className={isDarkMode ? 'bg-bg-card text-text-primary' : 'bg-bg-card text-text-primary'}>{p}</option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary group-hover/pod:text-primary-500 transition-colors" />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className={`p-2.5 rounded-xl transition-all border shadow-sm ${isPaused ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' : 'bg-bg-card border-border-main text-text-tertiary hover:text-text-primary hover:bg-bg-hover'}`}
                        title={isPaused ? "Resume Streaming" : "Pause Streaming"}
                    >
                        {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
                    </button>

                    <button
                        onClick={downloadLogs}
                        className="p-2.5 rounded-xl bg-bg-card border border-border-main text-text-tertiary hover:text-primary-500 hover:border-primary-500/30 transition-all shadow-sm active:scale-95"
                        title="Download Logs"
                    >
                        <Download className="w-4 h-4" />
                    </button>

                    {onClose && (
                        <button onClick={onClose} className="p-2.5 rounded-xl bg-bg-card border border-border-main text-text-tertiary hover:text-rose-500 hover:border-rose-500/30 transition-all shadow-sm active:scale-95 ml-2">
                            <XCircle className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-auto p-4 space-y-0.5 bg-bg-main/50 custom-scrollbar scroll-smooth"
            >
                {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-text-tertiary gap-6 opacity-60">
                        {status === 'connecting' ? (
                            <>
                                <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-primary-500/20" />
                                <p className="font-bold uppercase tracking-widest text-xs">Establishing Secure Uplink...</p>
                            </>
                        ) : status === 'error' ? (
                            <div className="text-center">
                                <p className="text-rose-600 dark:text-rose-400 font-black mb-2 uppercase tracking-tight">Protocol Error</p>
                                <p className="text-[10px] font-mono">{errorMsg}</p>
                            </div>
                        ) : (
                            <div className="text-center animate-pulse">
                                <Terminal className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p className="font-bold uppercase tracking-widest text-[10px]">Synchronizing telemetry stream...</p>
                            </div>
                        )}
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="hover:bg-bg-hover/50 px-3 py-1 rounded-md break-all whitespace-pre-wrap flex gap-4 group transition-colors border border-transparent hover:border-border-main/20">
                            <span className="text-text-tertiary select-none w-10 text-right shrink-0 opacity-30 font-bold border-r border-border-main/30 pr-3">{i + 1}</span>
                            <span className={`font-medium tracking-tight ${
                                log.includes('ERROR') || log.includes('Error') || log.includes('failed') ? 'text-rose-600 dark:text-rose-400' :
                                    log.includes('WARN') || log.includes('Warning') ? 'text-amber-600 dark:text-amber-400' :
                                        log.includes('INFO') ? 'text-blue-600 dark:text-blue-300' :
                                            'text-text-secondary'
                            }`}>
                                {log}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {/* Status Bar */}
            <div className="px-5 py-2 bg-bg-hover/50 text-xs text-text-tertiary font-bold uppercase tracking-widest flex justify-between border-t border-border-main shadow-inner">
                <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                    {logs.length} RECORDS_BUFFERED
                </span>
                <span className="flex items-center gap-4">
                    <span>POD_ID: {selectedPod}</span>
                    <span className={autoScroll ? 'text-emerald-500' : 'text-rose-500'}>AUTOSCROLL_{autoScroll ? 'ENABLED' : 'DISABLED'}</span>
                </span>
            </div>
        </div>
    );
};
