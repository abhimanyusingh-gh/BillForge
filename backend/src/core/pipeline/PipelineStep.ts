import type { PipelineContext } from "./PipelineContext.js";

export interface StepOutput {
  status?: "continue" | "skip" | "halt";
}

export interface PipelineStep {
  readonly name: string;
  execute(ctx: PipelineContext): Promise<StepOutput>;
}
