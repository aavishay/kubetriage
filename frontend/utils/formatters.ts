export const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (isNaN(diffInSeconds)) return dateString;

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

export const parseLogLine = (log: string): { time: string, level: string, msg: string, full: string } => {
    // Try to match key-value pairs typical in structured logs (logfmt)
    // time="2026-01-09..." level=info msg="..."
    const timeMatch = log.match(/time="([^"]+)"/);
    const levelMatch = log.match(/level=([a-zA-Z]+)/);
    const msgMatch = log.match(/msg="([^"]+)"/);

    return {
        time: timeMatch ? formatRelativeTime(timeMatch[1]) : '',
        level: levelMatch ? levelMatch[1] : '',
        msg: msgMatch ? msgMatch[1] : log,
        full: log
    };
};
