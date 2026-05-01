import { apiClient } from "@/api/client";
import { reportsUrls } from "@/api/urls/reportsUrls";

export const TDS_QUARTER = {
  Q1: "Q1",
  Q2: "Q2",
  Q3: "Q3",
  Q4: "Q4"
} as const;

export type TdsQuarter = (typeof TDS_QUARTER)[keyof typeof TDS_QUARTER];

export interface TdsLiabilitySectionBucket {
  section: string;
  cumulativeBaseMinor: number;
  cumulativeTdsMinor: number;
  invoiceCount: number;
  thresholdCrossedAt: string | null;
}

export interface TdsLiabilityVendorBucket {
  vendorFingerprint: string;
  section: string;
  cumulativeBaseMinor: number;
  cumulativeTdsMinor: number;
  invoiceCount: number;
  thresholdCrossedAt: string | null;
}

export interface TdsLiabilityQuarterBucket {
  quarter: TdsQuarter;
  section: string;
  cumulativeBaseMinor: number;
  cumulativeTdsMinor: number;
  invoiceCount: number;
}

export interface TdsLiabilityReport {
  tan: string | null;
  fy: string;
  bySection: TdsLiabilitySectionBucket[];
  byVendor: TdsLiabilityVendorBucket[];
  byQuarter: TdsLiabilityQuarterBucket[];
}

export interface TdsLiabilityQuery {
  fy: string;
  quarter?: TdsQuarter;
  vendorFingerprint?: string;
  section?: string;
}

export const TDS_LIABILITY_QUERY_KEY = "tdsLiabilityReport" as const;

export async function fetchTdsLiabilityReport(query: TdsLiabilityQuery): Promise<TdsLiabilityReport> {
  const params: Record<string, string> = { fy: query.fy };
  if (query.quarter) params.quarter = query.quarter;
  if (query.vendorFingerprint) params.vendorFingerprint = query.vendorFingerprint;
  if (query.section) params.section = query.section;
  const response = await apiClient.get<TdsLiabilityReport>(reportsUrls.tdsLiability(), { params });
  const data = response.data;
  return {
    tan: typeof data?.tan === "string" ? data.tan : null,
    fy: typeof data?.fy === "string" ? data.fy : query.fy,
    bySection: Array.isArray(data?.bySection) ? data.bySection : [],
    byVendor: Array.isArray(data?.byVendor) ? data.byVendor : [],
    byQuarter: Array.isArray(data?.byQuarter) ? data.byQuarter : []
  };
}
