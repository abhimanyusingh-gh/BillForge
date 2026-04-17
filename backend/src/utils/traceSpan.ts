const otelEnabled = process.env.OTEL_ENABLED === "true";

async function getTracer(name: string) {
  const { trace } = await import("@opentelemetry/api");
  return trace.getTracer(name);
}

interface TraceSpanOptions {
  tracerName: string;
  spanName: string;
  attributes?: Record<string, string | number | boolean>;
  timed?: boolean;
  timingKey?: string;
  onSuccess?: (result: unknown) => Record<string, string | number | boolean>;
}

export function traceSpan<T>(options: TraceSpanOptions, fn: () => Promise<T>): Promise<T> {
  if (!otelEnabled) return fn();

  return (async () => {
    const tracer = await getTracer(options.tracerName);
    const { SpanStatusCode } = await import("@opentelemetry/api");
    const { getCorrelationId } = await import("@/utils/logger.js");

    return tracer.startActiveSpan(options.spanName, async (span) => {
      const correlationId = getCorrelationId();
      if (correlationId) {
        span.setAttribute("correlation.id", correlationId);
      }
      if (options.attributes) {
        for (const [key, value] of Object.entries(options.attributes)) {
          span.setAttribute(key, value);
        }
      }
      const start = options.timed ? performance.now() : 0;
      const durationKey = options.timingKey ?? "duration_ms";
      try {
        const result = await fn();
        if (options.timed) {
          span.setAttribute(durationKey, Math.round(performance.now() - start));
        }
        if (options.onSuccess) {
          const attrs = options.onSuccess(result);
          for (const [key, value] of Object.entries(attrs)) {
            span.setAttribute(key, value);
          }
        }
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        if (options.timed) {
          span.setAttribute(durationKey, Math.round(performance.now() - start));
        }
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    });
  })();
}
