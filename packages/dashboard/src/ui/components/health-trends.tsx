import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ProjectSnapshot, ComponentHealth } from '@foxlight/core';

interface Snapshot {
  timestamp: string;
  data: ProjectSnapshot;
}

interface ChartDataPoint {
  timestamp: string;
  'Avg Health'?: number;
}

export function HealthTrends({ snapshots }: { snapshots: Snapshot[] }) {
  const chartData: ChartDataPoint[] = snapshots.map((snapshot) => {
    const point: ChartDataPoint = {
      timestamp: new Date(snapshot.timestamp).toLocaleDateString(),
    };

    // Average health score per snapshot
    if (snapshot.data.health && snapshot.data.health.length > 0) {
      const scores = snapshot.data.health
        .map((h: ComponentHealth) => h.score)
        .filter((s: number) => s > 0);
      if (scores.length > 0) {
        const average = Math.round(scores.reduce((a: number, b: number) => a + b) / scores.length);
        point['Avg Health'] = average;
      }
    }

    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="timestamp" />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="Avg Health" stroke="#f97316" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
