import {
  refreshGoogleAccessToken,
  exchangeGoogleAuthorizationCode,
  fetchGoogleUserEmail,
  isInvalidGrantError
} from "@/sources/email/gmailOAuthClient.ts";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";
const TIMEOUT_MS = 5000;

const BASE_REFRESH_INPUT = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  refreshToken: "test-refresh-token",
  tokenEndpoint: TOKEN_ENDPOINT,
  timeoutMs: TIMEOUT_MS
};

const BASE_EXCHANGE_INPUT = {
  code: "auth-code-abc",
  codeVerifier: "pkce-verifier-xyz",
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  redirectUri: "https://app.example.com/callback",
  tokenEndpoint: TOKEN_ENDPOINT,
  timeoutMs: TIMEOUT_MS
};

function createMockHttpClient(responseData: unknown) {
  return {
    post: jest.fn(async () => ({ data: responseData })),
    get: jest.fn(async () => ({ data: responseData }))
  };
}

describe("refreshGoogleAccessToken", () => {
  it("builds refresh_token grant body with client credentials and endpoint/timeout", async () => {
    const client = createMockHttpClient({ access_token: "fresh-access-token", expires_in: 3600 });

    const result = await refreshGoogleAccessToken(BASE_REFRESH_INPUT, client);

    expect(result.accessToken).toBe("fresh-access-token");
    expect(client.post).toHaveBeenCalledWith(
      TOKEN_ENDPOINT,
      expect.any(String),
      expect.objectContaining({ timeout: TIMEOUT_MS })
    );
    const body = String((client.post.mock.calls as unknown[][])[0][1]);
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("client_id=test-client-id");
    expect(body).toContain("client_secret=test-client-secret");
    expect(body).toContain("refresh_token=test-refresh-token");
  });

  it.each([
    ["defaults expires_in to 3600 when missing", { access_token: "tok" }, 3600],
    ["parses string expires_in value", { access_token: "tok", expires_in: "7200" }, 7200],
  ])("%s", async (_label, responseData, expectedSeconds) => {
    const client = createMockHttpClient(responseData);
    const result = await refreshGoogleAccessToken(BASE_REFRESH_INPUT, client);
    expect(result.expiresInSeconds).toBe(expectedSeconds);
  });

  it.each([
    ["error field invalid_grant", { error: "invalid_grant", error_description: "Token has been revoked." }, /Token has been revoked/],
    ["access_token missing", { expires_in: 3600 }, /access_token/],
    ["response body null", null, /access_token/],
  ])("throws when %s", async (_label, responseData, expectedMessage) => {
    const client = createMockHttpClient(responseData);
    await expect(refreshGoogleAccessToken(BASE_REFRESH_INPUT, client)).rejects.toThrow(expectedMessage);
  });
});

describe("exchangeGoogleAuthorizationCode", () => {
  it("sends code, code_verifier, redirect_uri in authorization_code grant body", async () => {
    const client = createMockHttpClient({
      access_token: "tok",
      refresh_token: "ref",
      expires_in: 3600
    });

    await exchangeGoogleAuthorizationCode(BASE_EXCHANGE_INPUT, client);

    const body = String((client.post.mock.calls as unknown[][])[0][1]);
    expect(body).toContain("code=auth-code-abc");
    expect(body).toContain("code_verifier=pkce-verifier-xyz");
    expect(body).toContain("redirect_uri=" + encodeURIComponent("https://app.example.com/callback"));
    expect(body).toContain("grant_type=authorization_code");
  });

  it.each([
    ["refresh_token missing (consent not granted)", { access_token: "tok", expires_in: 3600 }, /refresh_token/],
    ["access_token missing", { refresh_token: "ref" }, /access_token/],
    ["OAuth error response", { error: "invalid_request", error_description: "Missing required parameter." }, /Missing required parameter/],
  ])("throws when %s", async (_label, responseData, expectedMessage) => {
    const client = createMockHttpClient(responseData);
    await expect(exchangeGoogleAuthorizationCode(BASE_EXCHANGE_INPUT, client)).rejects.toThrow(expectedMessage);
  });
});

describe("fetchGoogleUserEmail", () => {
  it("normalizes email (lowercase + trim) and sends Bearer token in Authorization header", async () => {
    const client = createMockHttpClient({ email: "  User@Example.COM  " });

    const email = await fetchGoogleUserEmail("my-token-123", USERINFO_ENDPOINT, TIMEOUT_MS, client);

    expect(email).toBe("user@example.com");
    expect(client.get).toHaveBeenCalledWith(
      USERINFO_ENDPOINT,
      expect.objectContaining({
        headers: { Authorization: "Bearer my-token-123" }
      })
    );
  });

  it.each([
    ["email missing from response", {}],
    ["email is whitespace-only", { email: "   " }],
    ["email is non-string type", { email: 12345 }],
  ])("throws when %s", async (_label, responseData) => {
    const client = createMockHttpClient(responseData);
    await expect(fetchGoogleUserEmail("tok", USERINFO_ENDPOINT, TIMEOUT_MS, client)).rejects.toThrow(/email/);
  });
});

describe("isInvalidGrantError", () => {
  function makeAxiosError(data: unknown) {
    const error = Object.assign(new Error("fail"), {
      isAxiosError: true,
      response: { status: 400, data }
    });
    Object.defineProperty(error, "isAxiosError", { value: true, enumerable: true });
    return error;
  }

  it.each([
    ["invalid_grant lowercase", () => makeAxiosError({ error: "invalid_grant" }), true],
    ["invalid_grant uppercase", () => makeAxiosError({ error: "INVALID_GRANT" }), true],
    ["other axios error code", () => makeAxiosError({ error: "invalid_request" }), false],
    ["non-axios error", () => new Error("random error"), false],
    ["null", () => null, false],
    ["undefined", () => undefined, false],
  ])("%s", (_label, inputFn, expected) => {
    expect(isInvalidGrantError(inputFn())).toBe(expected);
  });
});
