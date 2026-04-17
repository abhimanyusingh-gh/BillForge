const otelEnabled = process.env.OTEL_ENABLED === "true";

async function getTracer() {
  const { trace } = await import("@opentelemetry/api");
  return trace.getTracer("billforge-ocr");
}

export function traceOcrExtract<T>(
  provider: string,
  tier: string,
  fn: () => Promise<T>,
  onResult?: (result: T) => { chars: number; blocks: number },
): Promise<T> {
  if (!otelEnabled) return fn();

  return (async () => {
    const tracer = await getTracer();
    const { SpanStatusCode } = await import("@opentelemetry/api");
    const { getCorrelationId } = await import("@/utils/logger.js");

    return tracer.startActiveSpan("ocr.llamaparse.extract", async (span) => {
      const correlationId = getCorrelationId();
      if (correlationId) {
        span.setAttribute("correlation.id", correlationId);
      }
      span.setAttribute("ocr.provider", provider);
      span.setAttribute("ocr.tier", tier);
      try {
        const result = await fn();
        if (onResult) {
          const metrics = onResult(result);
          span.setAttribute("ocr.chars", metrics.chars);
          span.setAttribute("ocr.blocks", metrics.blocks);
        }
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

export function traceExtractRun<T>(fn: () => Promise<T>): Promise<T> {
  if (!otelEnabled) return fn();

  return (async () => {
    const tracer = await getTracer();
    const { SpanStatusCode } = await import("@opentelemetry/api");
    const { getCorrelationId } = await import("@/utils/logger.js");

    return tracer.startActiveSpan("extract.llamaextract.run", async (span) => {
      const correlationId = getCorrelationId();
      if (correlationId) {
        span.setAttribute("correlation.id", correlationId);
      }
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
