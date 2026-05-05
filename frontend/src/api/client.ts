import { useSessionStore } from "@/state/sessionStore";

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
const API_BASE_URL = RAW_BASE === "" ? "" : RAW_BASE.replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  skipAuth?: boolean;
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/${path}`;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(status: number, body: unknown): string {
  if (body !== null && typeof body === "object") {
    const candidate = (body as Record<string, unknown>).message;
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
    const error = (body as Record<string, unknown>).error;
    if (typeof error === "string" && error.length > 0) return error;
  }
  if (typeof body === "string" && body.length > 0) return body;
  return `Request failed with status ${status}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, skipAuth = false } = options;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "LedgerBuddy"
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (!skipAuth) {
    const token = useSessionStore.getState().accessToken;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(resolveUrl(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    credentials: "same-origin"
  });

  const parsed = await parseBody(response);

  if (response.status === 401 && !skipAuth) {
    useSessionStore.getState().clearSession();
    if (typeof window !== "undefined" && !window.location.hash.startsWith("#/login")) {
      window.location.hash = "#/login";
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, extractErrorMessage(response.status, parsed), parsed);
  }

  return parsed as T;
}

export const apiClient = {
  get: <T,>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T,>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T,>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T,>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T,>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "DELETE" })
};
