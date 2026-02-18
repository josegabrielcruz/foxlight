import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
export function BundleExplorer({ data }) {
    if (!data.bundleInfo || data.bundleInfo.length === 0) {
        return (_jsx("p", { className: "text-gray-600", children: "No bundle data available. Enable the Vite or Webpack plugin to track bundle sizes." }));
    }
    const chartData = data.bundleInfo
        .map((info) => {
        const comp = data.components.find((c) => c.id === info.componentId);
        return {
            name: comp?.name ?? info.componentId,
            size: info.totalSize.raw / 1024, // Convert to KB
            componentId: info.componentId,
        };
    })
        .sort((a, b) => b.size - a.size)
        .slice(0, 10); // Top 10 by size
    if (chartData.length === 0) {
        return _jsx("p", { className: "text-gray-600", children: "No component bundle data available." });
    }
    return (_jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(BarChart, { data: chartData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "name", angle: -45, textAnchor: "end", height: 80, interval: 0, tick: { fontSize: 12 } }), _jsx(YAxis, { label: { value: 'Size (KB)', angle: -90, position: 'insideLeft' } }), _jsx(Tooltip, { formatter: (value) => `${value.toFixed(2)} KB` }), _jsx(Bar, { dataKey: "size", fill: "#f97316" })] }) }));
}
//# sourceMappingURL=bundle-explorer.js.map