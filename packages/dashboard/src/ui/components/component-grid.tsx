import type { ProjectSnapshot, ComponentHealth, ComponentInfo } from '@foxlight/core';

export function ComponentGrid({ data }: { data: ProjectSnapshot }) {
  if (!data.components || data.components.length === 0) {
    return (
      <p className="text-gray-600">
        No components found. Run <code>npx foxlight analyze</code> to scan your project.
      </p>
    );
  }

  // Map components to their health scores
  const componentHealth = new Map();
  if (data.health) {
    data.health.forEach((h: ComponentHealth) => {
      componentHealth.set(h.componentId, h);
    });
  }

  const components = data.components
    .map((comp: ComponentInfo) => ({
      ...comp,
      score: componentHealth.get(comp.id)?.score ?? 0,
      reason: componentHealth.get(comp.id)?.reasons?.[0],
    }))
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    .slice(0, 10); // Show top 10

  const getHealthColor = (score: number) => {
    if (!score) return 'bg-gray-100';
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getHealthTextColor = (score: number) => {
    if (!score) return 'text-gray-600';
    if (score >= 80) return 'text-green-700';
    if (score >= 60) return 'text-yellow-700';
    return 'text-red-700';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {components.map((component: { id: string; name: string; score: number; reason?: string }) => {
        return (
          <div
            key={component.id}
            className={`p-4 rounded-lg border border-gray-200 ${getHealthColor(component.score)}`}
          >
            <h3 className="font-semibold text-gray-900 truncate">{component.name}</h3>
            <div className="mt-2 flex items-end gap-2">
              <div className={`text-3xl font-bold ${getHealthTextColor(component.score)}`}>
                {Math.round(component.score)}
              </div>
              <div className="text-sm text-gray-600 mb-1">/ 100</div>
            </div>
            {component.reason && <p className="mt-3 text-xs text-gray-600">{component.reason}</p>}
          </div>
        );
      })}
    </div>
  );
}
