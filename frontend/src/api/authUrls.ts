export const authUrls = {
  login: () => "/api/auth/token",
  session: () => "/api/session",
  refresh: () => "/api/auth/refresh",
  changePassword: () => "/api/auth/change-password"
} as const;
