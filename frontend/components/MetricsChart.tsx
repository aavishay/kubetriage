import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface MetricPoint {
    timestamp: number;
    value: number;
}

interface MetricsChartProps {
    data: MetricPoint[];
    color?: string;
    height?: number;
    unit?: string;
    requestValue?: number;
}

export const MetricsChart: React.FC<MetricsChartProps> = ({ data, color = "#6366f1", height = 80, unit = "", requestValue }) => {
    if (!data || data.length === 0) {
        return <div className="h-full w-full flex items-center justify-center text-xs text-text-tertiary font-medium">No Data</div>;
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
                    <XAxis dataKey="timestamp" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'var(--kt-bg-card)',
                            border: '1px solid var(--kt-border-main)',
                            borderRadius: '8px',
                            fontSize: '10px',
                            color: 'var(--kt-fg-primary)',
                            boxShadow: 'var(--kt-shadow-sm)'
                        }}
                        itemStyle={{ color: 'var(--kt-fg-primary)' }}
                        formatter={(value: number) => [`${value.toFixed(2)}${unit}`, '']}
                        labelFormatter={() => ''}
                    />
                    {requestValue !== undefined && (
                        <ReferenceLine
                            y={requestValue}
                            stroke="var(--kt-warning)"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                            label={{
                                value: `Req: ${requestValue.toFixed(2)}${unit}`,
                                position: 'insideTopRight',
                                fill: 'var(--kt-warning)',
                                fontSize: 9,
                            }}
                        />
                    )}
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
