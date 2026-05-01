export const TDS_SECTION = {
  S_194A: "194A",
  S_194C: "194C",
  S_194H: "194H",
  S_194I: "194I",
  S_194I_A: "194I(a)",
  S_194I_B: "194I(b)",
  S_194J: "194J",
  S_194Q: "194Q"
} as const;

export type TdsSection = (typeof TDS_SECTION)[keyof typeof TDS_SECTION];
