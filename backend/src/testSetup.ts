jest.mock("./db/redis.js", () => {
  const store = new Map<string, string>();

  const mockClient = {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => { store.set(key, value); return "OK"; }),
    setex: jest.fn(async (key: string, _ttl: number, value: string) => { store.set(key, value); return "OK"; }),
    getdel: jest.fn(async (key: string) => { const v = store.get(key) ?? null; store.delete(key); return v; }),
    del: jest.fn(async (...keys: string[]) => { for (const k of keys) store.delete(k); return keys.length; }),
    quit: jest.fn(async () => "OK")
  };

  return {
    getRedisClient: jest.fn(() => mockClient),
    closeRedisClient: jest.fn(async () => { store.clear(); })
  };
});
