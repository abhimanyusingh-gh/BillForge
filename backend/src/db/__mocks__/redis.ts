const store = new Map<string, string>();
const ttlStore = new Map<string, number>();

const mockClient = {
  get: jest.fn(async (key: string) => store.get(key) ?? null),
  set: jest.fn(async (key: string, value: string) => { store.set(key, value); return "OK"; }),
  setex: jest.fn(async (key: string, _ttl: number, value: string) => { store.set(key, value); ttlStore.set(key, _ttl); return "OK"; }),
  getdel: jest.fn(async (key: string) => { const v = store.get(key) ?? null; store.delete(key); return v; }),
  del: jest.fn(async (key: string) => { store.delete(key); return 1; }),
  quit: jest.fn(async () => "OK")
};

export function getRedisClient() {
  return mockClient;
}

export async function closeRedisClient() {
  store.clear();
  ttlStore.clear();
}

export function __resetStore() {
  store.clear();
  ttlStore.clear();
  mockClient.get.mockClear();
  mockClient.set.mockClear();
  mockClient.setex.mockClear();
  mockClient.getdel.mockClear();
  mockClient.del.mockClear();
}
