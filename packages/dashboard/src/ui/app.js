import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { HealthTrends } from './components/health-trends.js';
import { ComponentGrid } from './components/component-grid.js';
import { BundleExplorer } from './components/bundle-explorer.js';
export function App() {
    const [latest, setLatest] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        Promise.all([fetchLatest(), fetchHistory()])
            .catch((err) => {
            setError(err instanceof Error ? err.message : 'Failed to load analysis');
        })
            .finally(() => setLoading(false));
    }, []);
    const fetchLatest = async () => {
        const res = await fetch('/api/analysis/latest');
        if (!res.ok)
            throw new Error('Failed to fetch latest analysis');
        setLatest((await res.json()));
    };
    const fetchHistory = async () => {
        const res = await fetch('/api/analysis/history?limit=30');
        if (!res.ok)
            throw new Error('Failed to fetch history');
        setHistory((await res.json()));
    };
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center h-screen bg-gray-50", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-4xl mb-4", children: "\uD83E\uDD8A" }), _jsx("p", { className: "text-gray-600", children: "Loading Foxlight analysis..." })] }) }));
    }
    if (error) {
        return (_jsx("div", { className: "flex items-center justify-center h-screen bg-gray-50", children: _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-red-600 mb-4", children: error }), _jsxs("p", { className: "text-sm text-gray-600", children: ["Make sure you've run ", _jsx("code", { children: "npx foxlight analyze" }), " first."] })] }) }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsx("header", { className: "bg-white border-b border-gray-200 sticky top-0 z-10", children: _jsxs("div", { className: "max-w-7xl mx-auto px-6 py-4", children: [_jsxs("h1", { className: "text-2xl font-bold text-gray-900 flex items-center gap-2", children: [_jsx("span", { className: "text-3xl", children: "\uD83E\uDD8A" }), " Foxlight Dashboard"] }), latest && (_jsxs("p", { className: "text-sm text-gray-600 mt-2", children: ["Last updated: ", new Date(latest.timestamp).toLocaleString()] }))] }) }), _jsx("main", { className: "max-w-7xl mx-auto px-6 py-8", children: _jsxs("div", { className: "space-y-8", children: [history.length > 1 && (_jsxs("section", { className: "bg-white rounded-lg shadow p-6", children: [_jsx("h2", { className: "text-xl font-semibold text-gray-900 mb-4", children: "Component Health Over Time" }), _jsx(HealthTrends, { snapshots: history })] })), latest && (_jsxs("section", { className: "bg-white rounded-lg shadow p-6", children: [_jsx("h2", { className: "text-xl font-semibold text-gray-900 mb-4", children: "Components" }), _jsx(ComponentGrid, { data: latest.data })] })), latest && latest.data.bundleInfo && latest.data.bundleInfo.length > 0 && (_jsxs("section", { className: "bg-white rounded-lg shadow p-6", children: [_jsx("h2", { className: "text-xl font-semibold text-gray-900 mb-4", children: "Bundle Size by Component" }), _jsx(BundleExplorer, { data: latest.data })] }))] }) })] }));
}
//# sourceMappingURL=app.js.map