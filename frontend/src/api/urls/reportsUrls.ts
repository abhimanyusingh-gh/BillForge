export const REPORTS_URL_PATHS = {
  tdsLiability: "/reports/tds-liability"
} as const;

export const reportsUrls = {
  tdsLiability: (): string => REPORTS_URL_PATHS.tdsLiability
};
