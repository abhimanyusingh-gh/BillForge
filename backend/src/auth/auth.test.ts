import type { Request, Response } from "express";
import { AuthService } from "@/auth/AuthService.js";
import { createSessionToken, verifySessionToken } from "@/auth/sessionToken.js";
import { createAuthenticationMiddleware, requireNotViewer, resolveBearerToken } from "@/auth/middleware.js";
import { env } from "@/config/env.js";
import { UserModel } from "@/models/core/User.js";
import { TenantModel } from "@/models/core/Tenant.js";
import { TenantUserRoleModel } from "@/models/core/TenantUserRole.js";
import type { OidcProvider } from "@/sts/OidcProvider.js";
import type { KeycloakAdminClient } from "@/keycloak/KeycloakAdminClient.js";
import { encryptSecret } from "@/utils/secretCrypto.js";
import { toUUID } from "@/types/uuid.js";

const TENANT_ID = toUUID("65f0000000000000000000a1");
const USER_ID = toUUID("65f0000000000000000000c3");

function makeMockOidc(overrides: Partial<OidcProvider> = {}): OidcProvider {
  return {
    getAuthorizationUrl: jest.fn(),
    exchangeAuthorizationCode: jest.fn(),
    validateAccessToken: jest.fn().mockResolvedValue({
      active: true, sub: "kc-subject-1",
      email: "tenant-admin-1@local.test", name: "Tenant Admin 1"
    }),
    normalizeClaims: jest.fn().mockReturnValue({
      subject: "kc-subject-1", email: "tenant-admin-1@local.test", name: "Tenant Admin 1"
    }),
    exchangePasswordGrant: jest.fn().mockResolvedValue({ accessToken: "mock-access-token", ok: true }),
    refreshAccessToken: jest.fn().mockResolvedValue({ accessToken: "refreshed-access-token", refreshToken: "refreshed-kc-token" }),
    ...overrides
  };
}

function makeMockKcAdmin(): jest.Mocked<KeycloakAdminClient> {
  return {
    createUser: jest.fn(), setPassword: jest.fn(), findUserByEmail: jest.fn(),
    userExists: jest.fn(), deleteUser: jest.fn(), executeActionsEmail: jest.fn()
  } as unknown as jest.Mocked<KeycloakAdminClient>;
}

describe("loginWithPassword", () => {
  beforeEach(() => { jest.restoreAllMocks(); });

  it("issues a session token when credentials are valid", async () => {
    const oidc = makeMockOidc();
    const authService = new AuthService(oidc, makeMockKcAdmin());

    const mockUser = {
      _id: USER_ID, email: "tenant-admin-1@local.test",
      tenantId: TENANT_ID, externalSubject: "old-subject",
      enabled: true, displayName: "Tenant Admin 1",
      encryptedRefreshToken: "", lastLoginAt: new Date(),
      save: jest.fn().mockResolvedValue(undefined)
    };
    jest.spyOn(UserModel, "findOne").mockResolvedValue(mockUser as never);
    jest.spyOn(TenantModel, "findById").mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: TENANT_ID, name: "Tenant Alpha", onboardingStatus: "completed" })
    } as never);
    jest.spyOn(TenantUserRoleModel, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue({ role: "TENANT_ADMIN" })
    } as never);
    const updateOneSpy = jest.spyOn(UserModel, "updateOne").mockResolvedValue({} as never);

    const result = await authService.loginWithPassword("tenant-admin-1@local.test", "DemoPass!1");

    expect(oidc.exchangePasswordGrant).toHaveBeenCalledWith("tenant-admin-1@local.test", "DemoPass!1");
    expect(result.context.role).toBe("TENANT_ADMIN");
    expect(result.context.tenantId).toBe(TENANT_ID);
    expect(updateOneSpy).toHaveBeenCalledWith(
      { email: "tenant-admin-1@local.test" },
      { $set: { lastLoginAt: expect.any(Date) } }
    );

    const verified = verifySessionToken(result.sessionToken, env.APP_SESSION_SIGNING_SECRET);
    expect(verified.role).toBe("TENANT_ADMIN");
    expect(verified.userId).toBe(USER_ID);
  });

  it("rejects login when ROPC returns not-ok", async () => {
    const oidc = makeMockOidc({
      exchangePasswordGrant: jest.fn().mockResolvedValue({ accessToken: "", ok: false })
    });
    const authService = new AuthService(oidc, makeMockKcAdmin());
    await expect(authService.loginWithPassword("tenant-admin-1@local.test", "wrong")).rejects.toEqual(
      expect.objectContaining({ statusCode: 401, code: "auth_credentials_invalid" })
    );
  });

  it("rejects login when email is empty", async () => {
    const authService = new AuthService(makeMockOidc(), makeMockKcAdmin());
    await expect(authService.loginWithPassword("", "DemoPass!1")).rejects.toEqual(
      expect.objectContaining({ statusCode: 400, code: "auth_credentials_missing" })
    );
  });

  it("rejects when user not found and not auto-provisioned", async () => {
    const authService = new AuthService(makeMockOidc(), makeMockKcAdmin());
    jest.spyOn(UserModel, "findOne").mockResolvedValue(null as never);
    await expect(authService.loginWithPassword("unknown@local.test", "DemoPass!1")).rejects.toEqual(
      expect.objectContaining({ statusCode: 403, code: "auth_user_not_provisioned" })
    );
  });
});

describe("auth middleware", () => {
  it.each([
    [
      "prefers authToken query when authorization header token is invalid",
      (name: string) => (name.toLowerCase() === "authorization" ? "Bearer undefined" : undefined),
      "/jobs/ingest/sse",
      "query-token-1"
    ],
    [
      "uses query token when authorization header is missing",
      () => undefined,
      "/invoices/abc123/preview",
      "query-token-2"
    ],
  ])("%s", (_label, headerFn, path, expectedToken) => {
    const request = {
      header: headerFn,
      path,
      query: { authToken: expectedToken }
    } as unknown as Request;
    expect(resolveBearerToken(request)).toBe(expectedToken);
  });

  it("ignores query token on non-allowlisted paths", () => {
    const request = {
      header: () => undefined,
      path: "/invoices",
      query: { authToken: "sneaky-token" }
    } as unknown as Request;
    expect(resolveBearerToken(request)).toBe("");
  });

  it("authenticates request using query token", async () => {
    const authService = {
      resolveRequestContext: jest.fn().mockResolvedValue({
        userId: "u1", email: "u@example.com", tenantId: "t1",
        tenantName: "Tenant", onboardingStatus: "completed",
        role: "TENANT_ADMIN", isPlatformAdmin: false
      })
    };
    const middleware = createAuthenticationMiddleware(authService as never);
    const request = {
      header: () => undefined,
      path: "/invoices/abc123/preview",
      query: { authToken: "image-token" }
    } as unknown as Request;
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    await middleware(request, response, next);

    expect(authService.resolveRequestContext).toHaveBeenCalledWith("image-token");
    expect(next).toHaveBeenCalledTimes(1);
    expect((request as { authContext?: unknown }).authContext).toBeDefined();
  });
});

describe("requireNotViewer", () => {
  it("blocks audit_clerk role with 403", () => {
    const request = { authContext: { userId: "v1", role: "audit_clerk" } } as unknown as Request;
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();
    requireNotViewer(request, response, next);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows ap_clerk role", () => {
    const request = { authContext: { userId: "m1", role: "ap_clerk" } } as unknown as Request;
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();
    requireNotViewer(request, response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("allows TENANT_ADMIN role", () => {
    const request = { authContext: { userId: "a1", role: "TENANT_ADMIN" } } as unknown as Request;
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();
    requireNotViewer(request, response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when authContext is missing", () => {
    const request = { authContext: null } as unknown as Request;
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn();
    requireNotViewer(request, response, next);
    expect(response.status).toHaveBeenCalledWith(401);
  });
});

describe("refreshSession", () => {
  beforeEach(() => { jest.restoreAllMocks(); });

  function makeValidSessionToken() {
    return createSessionToken({
      userId: USER_ID, email: "user@test.com",
      tenantId: TENANT_ID, role: "TENANT_ADMIN",
      isPlatformAdmin: false,
      ttlSeconds: 3600, secret: env.APP_SESSION_SIGNING_SECRET
    });
  }

  function makeEncryptedRefreshToken() {
    return encryptSecret("kc-refresh-token-value", env.REFRESH_TOKEN_ENCRYPTION_SECRET);
  }

  function mockUserFindById(overrides: Partial<{ encryptedRefreshToken: string | null }> = {}) {
    const user = {
      _id: USER_ID,
      email: "user@test.com",
      tenantId: TENANT_ID,
      encryptedRefreshToken: overrides.encryptedRefreshToken !== undefined
        ? overrides.encryptedRefreshToken
        : makeEncryptedRefreshToken(),
      save: jest.fn().mockResolvedValue(undefined)
    };
    jest.spyOn(UserModel, "findById").mockResolvedValue(user as never);
    return user;
  }

  it("returns a new session token when refresh succeeds", async () => {
    mockUserFindById();
    jest.spyOn(TenantModel, "findById").mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: TENANT_ID, name: "Tenant Alpha", onboardingStatus: "completed" })
    } as never);
    jest.spyOn(TenantUserRoleModel, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue({ role: "TENANT_ADMIN" })
    } as never);

    const oidc = makeMockOidc({
      refreshAccessToken: jest.fn().mockResolvedValue({
        accessToken: "new-access-token",
        refreshToken: "new-kc-refresh-token"
      })
    } as unknown as Partial<OidcProvider>);
    const authService = new AuthService(oidc, makeMockKcAdmin());

    const result = await authService.refreshSession(makeValidSessionToken());

    expect(result).toHaveProperty("sessionToken");
    const verified = verifySessionToken(result.sessionToken, env.APP_SESSION_SIGNING_SECRET);
    expect(verified.userId).toBe(USER_ID);
    expect(verified.role).toBe("TENANT_ADMIN");
  });

  it("throws auth_session_invalid when session token is malformed", async () => {
    const authService = new AuthService(makeMockOidc(), makeMockKcAdmin());
    await expect(authService.refreshSession("not.a.valid.token")).rejects.toEqual(
      expect.objectContaining({ statusCode: 401, code: "auth_session_invalid" })
    );
  });

  it("throws auth_user_missing when user is not found", async () => {
    jest.spyOn(UserModel, "findById").mockResolvedValue(null as never);
    const authService = new AuthService(makeMockOidc(), makeMockKcAdmin());
    await expect(authService.refreshSession(makeValidSessionToken())).rejects.toEqual(
      expect.objectContaining({ statusCode: 401, code: "auth_user_missing" })
    );
  });

  it("throws auth_user_missing when user has no refresh token", async () => {
    mockUserFindById({ encryptedRefreshToken: null });
    const authService = new AuthService(makeMockOidc(), makeMockKcAdmin());
    await expect(authService.refreshSession(makeValidSessionToken())).rejects.toEqual(
      expect.objectContaining({ statusCode: 401, code: "auth_user_missing" })
    );
  });

  it("throws auth_refresh_decrypt_failed when refresh token cannot be decrypted", async () => {
    mockUserFindById({ encryptedRefreshToken: "invalid-payload" });
    const authService = new AuthService(makeMockOidc(), makeMockKcAdmin());
    await expect(authService.refreshSession(makeValidSessionToken())).rejects.toEqual(
      expect.objectContaining({ statusCode: 401, code: "auth_refresh_decrypt_failed" })
    );
  });

  it("throws auth_refresh_failed when Keycloak refresh call fails", async () => {
    mockUserFindById();
    const oidc = makeMockOidc({
      refreshAccessToken: jest.fn().mockRejectedValue(new Error("Keycloak token expired"))
    } as unknown as Partial<OidcProvider>);
    const authService = new AuthService(oidc, makeMockKcAdmin());
    await expect(authService.refreshSession(makeValidSessionToken())).rejects.toEqual(
      expect.objectContaining({ statusCode: 401, code: "auth_refresh_failed" })
    );
  });

  it("throws auth_tenant_missing when tenant is not found after refresh", async () => {
    mockUserFindById();
    jest.spyOn(TenantModel, "findById").mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    } as never);
    jest.spyOn(TenantUserRoleModel, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue({ role: "TENANT_ADMIN" })
    } as never);
    const oidc = makeMockOidc({
      refreshAccessToken: jest.fn().mockResolvedValue({
        accessToken: "new-access-token",
        refreshToken: "new-kc-refresh-token"
      })
    } as unknown as Partial<OidcProvider>);
    const authService = new AuthService(oidc, makeMockKcAdmin());
    await expect(authService.refreshSession(makeValidSessionToken())).rejects.toEqual(
      expect.objectContaining({ statusCode: 401, code: "auth_tenant_missing" })
    );
  });

  it("throws auth_role_missing when role record is not found after refresh", async () => {
    mockUserFindById();
    jest.spyOn(TenantModel, "findById").mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: TENANT_ID, name: "Tenant Alpha", onboardingStatus: "completed" })
    } as never);
    jest.spyOn(TenantUserRoleModel, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    } as never);
    const oidc = makeMockOidc({
      refreshAccessToken: jest.fn().mockResolvedValue({
        accessToken: "new-access-token",
        refreshToken: "new-kc-refresh-token"
      })
    } as unknown as Partial<OidcProvider>);
    const authService = new AuthService(oidc, makeMockKcAdmin());
    await expect(authService.refreshSession(makeValidSessionToken())).rejects.toEqual(
      expect.objectContaining({ statusCode: 401, code: "auth_role_missing" })
    );
  });

  it("saves re-encrypted refresh token to user document", async () => {
    const user = mockUserFindById();
    jest.spyOn(TenantModel, "findById").mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: TENANT_ID, name: "Tenant Alpha", onboardingStatus: "completed" })
    } as never);
    jest.spyOn(TenantUserRoleModel, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue({ role: "TENANT_ADMIN" })
    } as never);
    const oidc = makeMockOidc({
      refreshAccessToken: jest.fn().mockResolvedValue({
        accessToken: "new-access-token",
        refreshToken: "new-kc-refresh-token"
      })
    } as unknown as Partial<OidcProvider>);
    const authService = new AuthService(oidc, makeMockKcAdmin());

    await authService.refreshSession(makeValidSessionToken());

    expect(user.save).toHaveBeenCalledTimes(1);
    expect(user.encryptedRefreshToken).not.toBe(makeEncryptedRefreshToken());
  });
});
