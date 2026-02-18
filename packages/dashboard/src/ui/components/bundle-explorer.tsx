import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ProjectSnapshot, ComponentBundleInfo, ComponentInfo } from '@foxlight/core';

export function BundleExplorer({ data }: { data: ProjectSnapshot }) {
  if (!data.bundleInfo || data.bundleInfo.length === 0) {
    return (
      <p className="text-gray-600">
        No bundle data available. Enable the Vite or Webpack plugin to track bundle sizes.
      </p>
    );
  }

  const chartData = data.bundleInfo
    .map((info: ComponentBundleInfo) => {
      const comp = data.components.find((c: ComponentInfo) => c.id === info.componentId);
      return {
        name: comp?.name ?? info.componentId,
        size: info.totalSize.raw / 1024, // Convert to KB
        componentId: info.componentId,
      };
    })
    .sort((a: { size: number }, b: { size: number }) => b.size - a.size)
    .slice(0, 10); // Top 10 by size

  if (chartData.length === 0) {
    return <p className="text-gray-600">No component bundle data available.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          angle={-45}
          textAnchor="end"
          height={80}
          interval={0}
          tick={{ fontSize: 12 }}
        />
        <YAxis label={{ value: 'Size (KB)', angle: -90, position: 'insideLeft' }} />
        <Tooltip formatter={(value) => `${(value as number).toFixed(2)} KB`} />
        <Bar dataKey="size" fill="#f97316" />
      </BarChart>
    </ResponsiveContainer>
  );
}
