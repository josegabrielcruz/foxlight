import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, } from 'recharts';
export function HealthTrends({ snapshots }) {
    const chartData = snapshots.map((snapshot) => {
        const point = {
            timestamp: new Date(snapshot.timestamp).toLocaleDateString(),
        };
        // Average health score per snapshot
        if (snapshot.data.health && snapshot.data.health.length > 0) {
            const scores = snapshot.data.health
                .map((h) => h.score)
                .filter((s) => s > 0);
            if (scores.length > 0) {
                const average = Math.round(scores.reduce((a, b) => a + b) / scores.length);
                point['Avg Health'] = average;
            }
        }
        return point;
    });
    return (_jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(LineChart, { data: chartData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "timestamp" }), _jsx(YAxis, { domain: [0, 100] }), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "Avg Health", stroke: "#f97316", dot: false, strokeWidth: 2 })] }) }));
}
//# sourceMappingURL=health-trends.js.map