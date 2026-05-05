interface AppConfig {
  apiBaseUrl: string;
}

function readApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (raw === "") return "";
  return raw.replace(/\/+$/, "");
}

export const appConfig: AppConfig = {
  apiBaseUrl: readApiBaseUrl()
};
