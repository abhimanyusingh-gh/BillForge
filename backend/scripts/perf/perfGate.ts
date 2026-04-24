import { performance } from "node:perf_hooks";

const GATE_STATUS = {
  PASS: "PASS",
  FAIL: "FAIL"
} as const;

type GateStatus = (typeof GATE_STATUS)[keyof typeof GATE_STATUS];

export const IMPLEMENTATION_STATUS = {
  PLACEHOLDER: "placeholder",
  LIVE: "live"
} as const;

type ImplementationStatus =
  (typeof IMPLEMENTATION_STATUS)[keyof typeof IMPLEMENTATION_STATUS];

interface PerfGateConfig {
  id: string;
  nfr: string;
  budgetMs: number;
  iterations: number;
  warmup: number;
  implementation: ImplementationStatus;
  compute: () => Promise<void> | void;
}

interface PerfGateOutcome {
  id: string;
  nfr: string;
  budgetMs: number;
  p95Ms: number;
  p99Ms: number;
  meanMs: number;
  iterations: number;
  status: GateStatus;
  implementation: ImplementationStatus;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, rank)];
}

export async function runPerfGate(config: PerfGateConfig): Promise<PerfGateOutcome> {
  for (let i = 0; i < config.warmup; i += 1) {
    await config.compute();
  }

  const samples: number[] = new Array(config.iterations);
  for (let i = 0; i < config.iterations; i += 1) {
    const start = performance.now();
    await config.compute();
    samples[i] = performance.now() - start;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const status: GateStatus = p95 <= config.budgetMs ? GATE_STATUS.PASS : GATE_STATUS.FAIL;

  return {
    id: config.id,
    nfr: config.nfr,
    budgetMs: config.budgetMs,
    p95Ms: p95,
    p99Ms: p99,
    meanMs: mean,
    iterations: config.iterations,
    status,
    implementation: config.implementation
  };
}

export function reportPerfGate(outcome: PerfGateOutcome): void {
  const line =
    `PERF_BUDGET: ${outcome.id} nfr=${outcome.nfr} ` +
    `p95=${outcome.p95Ms.toFixed(2)}ms p99=${outcome.p99Ms.toFixed(2)}ms ` +
    `mean=${outcome.meanMs.toFixed(2)}ms budget=${outcome.budgetMs}ms ` +
    `iters=${outcome.iterations} impl=${outcome.implementation} ${outcome.status}`;
  // eslint-disable-next-line no-console
  console.log(line);
  if (outcome.implementation === IMPLEMENTATION_STATUS.PLACEHOLDER) {
    // eslint-disable-next-line no-console
    console.warn(
      `PERF_BUDGET_WARN: ${outcome.id} is measuring a placeholder compute. ` +
        "Phase 2/4 must swap in the real module; the budget still enforces end-to-end."
    );
  }
}

export function exitFromOutcome(outcome: PerfGateOutcome): void {
  if (outcome.status === GATE_STATUS.FAIL) {
    process.exit(1);
  }
}
