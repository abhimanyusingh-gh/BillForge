const otelEnabled = process.env.OTEL_ENABLED === "true";

async function getTracer() {
  const { trace } = await import("@opentelemetry/api");
  return trace.getTracer("billforge-pipeline");
}

export function tracePipelineStep<T>(stepName: string, fn: () => Promise<T>): Promise<T> {
  if (!otelEnabled) return fn();

  return (async () => {
    const tracer = await getTracer();
    const { SpanStatusCode } = await import("@opentelemetry/api");
    const { getCorrelationId } = await import("@/utils/logger.js");

    return tracer.startActiveSpan(`pipeline.step.${stepName}`, async (span) => {
      const correlationId = getCorrelationId();
      if (correlationId) {
        span.setAttribute("correlation.id", correlationId);
      }
      span.setAttribute("step.name", stepName);
      const start = performance.now();
      try {
        const result = await fn();
        const durationMs = performance.now() - start;
        span.setAttribute("step.duration_ms", Math.round(durationMs));
        span.setAttribute("step.status", "continue");
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const durationMs = performance.now() - start;
        span.setAttribute("step.duration_ms", Math.round(durationMs));
        span.setAttribute("step.status", "error");
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

export function tracePipelineExecution<T>(pipelineName: string, fn: () => Promise<T>): Promise<T> {
  if (!otelEnabled) return fn();

  return (async () => {
    const tracer = await getTracer();
    const { SpanStatusCode } = await import("@opentelemetry/api");
    const { getCorrelationId } = await import("@/utils/logger.js");

    return tracer.startActiveSpan(`pipeline.execute`, async (span) => {
      const correlationId = getCorrelationId();
      if (correlationId) {
        span.setAttribute("correlation.id", correlationId);
      }
      span.setAttribute("pipeline.name", pipelineName);
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
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
