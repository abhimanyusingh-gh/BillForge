import { createHmac, timingSafeEqual } from "node:crypto";

interface SessionTokenPayload {
  sub: string;
  email: string;
  tenantId: string;
  iat: number;
  exp: number;
}

export interface CreateSessionTokenInput {
  userId: string;
  email: string;
  tenantId: string;
  ttlSeconds: number;
  secret: string;
}

export interface VerifiedSessionToken {
  userId: string;
  email: string;
  tenantId: string;
}

export function createSessionToken(input: CreateSessionTokenInput): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    sub: input.userId,
    email: input.email,
    tenantId: input.tenantId,
    iat: nowSeconds,
    exp: nowSeconds + input.ttlSeconds
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload, input.secret);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string, secret: string): VerifiedSessionToken {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) {
    throw new Error("Session token format is invalid.");
  }

  const expectedSignature = sign(payloadPart, secret);
  const actual = Buffer.from(signaturePart, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Session token signature is invalid.");
  }

  let payload: SessionTokenPayload;
  try {
    payload = JSON.parse(fromBase64Url(payloadPart)) as SessionTokenPayload;
  } catch {
    throw new Error("Session token payload is invalid JSON.");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Session token payload is invalid.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds) {
    throw new Error("Session token has expired.");
  }

  const userId = normalizeString(payload.sub);
  const email = normalizeString(payload.email);
  const tenantId = normalizeString(payload.tenantId);
  if (!userId || !email || !tenantId) {
    throw new Error("Session token payload is incomplete.");
  }

  return {
    userId,
    email,
    tenantId
  };
}

function sign(payloadPart: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadPart).digest("base64url");
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed;
}
