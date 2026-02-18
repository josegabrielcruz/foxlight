import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ComponentGrid({ data }) {
    if (!data.components || data.components.length === 0) {
        return (_jsxs("p", { className: "text-gray-600", children: ["No components found. Run ", _jsx("code", { children: "npx foxlight analyze" }), " to scan your project."] }));
    }
    // Map components to their health scores
    const componentHealth = new Map();
    if (data.health) {
        data.health.forEach((h) => {
            componentHealth.set(h.componentId, h);
        });
    }
    const components = data.components
        .map((comp) => ({
        ...comp,
        score: componentHealth.get(comp.id)?.score ?? 0,
        reason: componentHealth.get(comp.id)?.reasons?.[0],
    }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // Show top 10
    const getHealthColor = (score) => {
        if (!score)
            return 'bg-gray-100';
        if (score >= 80)
            return 'bg-green-100';
        if (score >= 60)
            return 'bg-yellow-100';
        return 'bg-red-100';
    };
    const getHealthTextColor = (score) => {
        if (!score)
            return 'text-gray-600';
        if (score >= 80)
            return 'text-green-700';
        if (score >= 60)
            return 'text-yellow-700';
        return 'text-red-700';
    };
    return (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: components.map((component) => {
            return (_jsxs("div", { className: `p-4 rounded-lg border border-gray-200 ${getHealthColor(component.score)}`, children: [_jsx("h3", { className: "font-semibold text-gray-900 truncate", children: component.name }), _jsxs("div", { className: "mt-2 flex items-end gap-2", children: [_jsx("div", { className: `text-3xl font-bold ${getHealthTextColor(component.score)}`, children: Math.round(component.score) }), _jsx("div", { className: "text-sm text-gray-600 mb-1", children: "/ 100" })] }), component.reason && _jsx("p", { className: "mt-3 text-xs text-gray-600", children: component.reason })] }, component.id));
        }) }));
}
//# sourceMappingURL=component-grid.js.map