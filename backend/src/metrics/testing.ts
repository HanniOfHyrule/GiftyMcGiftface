import { Counter, Gauge } from 'prom-client';

// Liest den aktuellen Wert eines Zählers/Gauges für genau diese Labels.
// Die Registry ist global und wird zwischen Tests einer Datei geteilt, daher
// vergleichen Tests immer vorher/nachher statt absoluter Werte.
export async function metricValue(
  metric: Counter | Gauge,
  labels: Record<string, string> = {},
): Promise<number> {
  const { values } = await metric.get();
  const wanted = Object.entries(labels);
  const match = values.find(
    (v) =>
      Object.keys(v.labels).length === wanted.length &&
      wanted.every(([k, val]) => v.labels[k] === val),
  );
  return match?.value ?? 0;
}

// Führt fn aus und liefert, um wie viel sich der Wert dabei verändert hat.
export async function metricDelta(
  metric: Counter | Gauge,
  labels: Record<string, string>,
  fn: () => Promise<unknown>,
): Promise<number> {
  const before = await metricValue(metric, labels);
  await fn();
  return (await metricValue(metric, labels)) - before;
}
