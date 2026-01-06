import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface MetricPoint {
    timestamp: number;
    value: number;
}

interface MetricsChartProps {
    data: MetricPoint[];
    color?: string;
    height?: number;
    unit?: string;
}

export const MetricsChart: React.FC<MetricsChartProps> = ({ data, color = "#6366f1", height = 80, unit = "" }) => {
    if (!data || data.length === 0) {
        return <div className="h-full w-full flex items-center justify-center text-xs text-zinc-400">No Data</div>;
    }

    return (
        <div style={{ width: '100%', height: height }}>
            <ResponsiveContainer>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    {/* Hide axes for sparkline look, but kept Y domain auto for scaling */}
                    <XAxis dataKey="timestamp" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '10px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value: number) => [`${value.toFixed(2)}${unit}`, '']}
                        labelFormatter={() => ''}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill={`url(#gradient-${color})`}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
