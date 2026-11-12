import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { performance } from "node:perf_hooks";
const base = process.argv[2] || "http://localhost:3000";
const samples = Number(process.env.MONITOR_SAMPLES || 3),
  interval = Number(process.env.MONITOR_INTERVAL_MS || 1000);
if (
  !Number.isInteger(samples) ||
  samples < 1 ||
  samples > 10000 ||
  !Number.isFinite(interval) ||
  interval < 100 ||
  interval > 60000
)
  throw new Error("Неверные параметры мониторинга");
const output = process.env.MONITOR_OUTPUT;
if (output) mkdirSync(dirname(output), { recursive: true });
const durations = [];
let failures = 0;
function emit(record) {
  const line = JSON.stringify(record);
  console.log(line);
  if (output) appendFileSync(output, line + "\n");
}
for (let i = 0; i < samples; i++) {
  const results = await Promise.all(
    ["live", "ready"].map(async (name) => {
      const start = performance.now();
      try {
        const response = await fetch(
          `${base.replace(/\/$/, "")}/api/health/${name}`,
          { signal: AbortSignal.timeout(3000) },
        );
        await response.arrayBuffer();
        const ms = +(performance.now() - start).toFixed(2);
        durations.push(ms);
        if (!response.ok) failures++;
        return {
          name,
          status: response.status,
          ms,
          requestId: response.headers.get("x-request-id"),
        };
      } catch {
        failures++;
        return {
          name,
          status: 0,
          ms: +(performance.now() - start).toFixed(2),
          error: "Соединение недоступно",
        };
      }
    }),
  );
  emit({
    event: "availability_check",
    at: new Date().toISOString(),
    sample: i + 1,
    checks: results,
  });
  if (i + 1 < samples) await sleep(interval);
}
durations.sort((a, b) => a - b);
emit({
  event: "availability_summary",
  checks: samples * 2,
  failures,
  error_rate: failures / (samples * 2),
  p95_ms: durations.length
    ? durations[Math.ceil(durations.length * 0.95) - 1]
    : null,
});
if (failures) process.exitCode = 1;
