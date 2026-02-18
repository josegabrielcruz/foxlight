import { useEffect, useState } from 'react';
import type { ProjectSnapshot } from '@foxlight/core';
import { HealthTrends } from './components/health-trends.js';
import { ComponentGrid } from './components/component-grid.js';
import { BundleExplorer } from './components/bundle-explorer.js';

interface Snapshot {
  timestamp: string;
  data: ProjectSnapshot;
}

export function App() {
  const [latest, setLatest] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchLatest(), fetchHistory()])
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load analysis');
      })
      .finally(() => setLoading(false));
  }, []);

  const fetchLatest = async () => {
    const res = await fetch('/api/analysis/latest');
    if (!res.ok) throw new Error('Failed to fetch latest analysis');
    setLatest((await res.json()) as Snapshot);
  };

  const fetchHistory = async () => {
    const res = await fetch('/api/analysis/history?limit=30');
    if (!res.ok) throw new Error('Failed to fetch history');
    setHistory((await res.json()) as Snapshot[]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">🦊</div>
          <p className="text-gray-600">Loading Foxlight analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-sm text-gray-600">
            Make sure you've run <code>npx foxlight analyze</code> first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-3xl">🦊</span> Foxlight Dashboard
          </h1>
          {latest && (
            <p className="text-sm text-gray-600 mt-2">
              Last updated: {new Date(latest.timestamp).toLocaleString()}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Health Trends */}
          {history.length > 1 && (
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Component Health Over Time
              </h2>
              <HealthTrends snapshots={history} />
            </section>
          )}

          {/* Component Grid */}
          {latest && (
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Components</h2>
              <ComponentGrid data={latest.data} />
            </section>
          )}

          {/* Bundle Explorer */}
          {latest && latest.data.bundleInfo && latest.data.bundleInfo.length > 0 && (
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Bundle Size by Component</h2>
              <BundleExplorer data={latest.data} />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
