import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { S3FileStore } from "./S3FileStore.js";

const LOCALSTACK_ENDPOINT = process.env.LOCALSTACK_ENDPOINT;
const TEST_BUCKET = "billforge-integration-test";
const TEST_REGION = "us-east-1";

const describeIf = LOCALSTACK_ENDPOINT ? describe : describe.skip;

describeIf("S3FileStore (LocalStack integration)", () => {
  let store: S3FileStore;

  beforeAll(async () => {
    const client = new S3Client({
      region: TEST_REGION,
      endpoint: LOCALSTACK_ENDPOINT,
      forcePathStyle: true,
      credentials: { accessKeyId: "test", secretAccessKey: "test" }
    });

    try {
      await client.send(new CreateBucketCommand({ Bucket: TEST_BUCKET }));
    } catch {
    }

    store = new S3FileStore({
      bucket: TEST_BUCKET,
      region: TEST_REGION,
      endpoint: LOCALSTACK_ENDPOINT,
      forcePathStyle: true
    });
  });

  it("putObject + getObject round-trip", async () => {
    const body = Buffer.from("invoice-content-pdf-bytes");
    await store.putObject({
      key: "roundtrip/test-invoice.pdf",
      body,
      contentType: "application/pdf",
      metadata: { tenantId: "t1" }
    });

    const result = await store.getObject("roundtrip/test-invoice.pdf");
    expect(Buffer.from(result.body).toString()).toBe("invoice-content-pdf-bytes");
    expect(result.contentType).toBe("application/pdf");
  });

  it("listObjects returns correct keys under a prefix", async () => {
    await store.putObject({ key: "list-test/a.pdf", body: Buffer.from("a"), contentType: "application/pdf" });
    await store.putObject({ key: "list-test/b.pdf", body: Buffer.from("b"), contentType: "application/pdf" });
    await store.putObject({ key: "other/c.pdf", body: Buffer.from("c"), contentType: "application/pdf" });

    const results = await store.listObjects("list-test");
    const keys = results.map((r) => r.key);
    expect(keys).toContain("list-test/a.pdf");
    expect(keys).toContain("list-test/b.pdf");
    expect(keys).not.toContain("other/c.pdf");
  });

  it("listObjects with empty prefix returns empty array", async () => {
    const tempStore = new S3FileStore({
      bucket: TEST_BUCKET,
      region: TEST_REGION,
      prefix: "empty-prefix-test",
      endpoint: LOCALSTACK_ENDPOINT,
      forcePathStyle: true
    });
    const results = await tempStore.listObjects("nonexistent");
    expect(results).toEqual([]);
  });

  it("deleteObject removes object", async () => {
    await store.putObject({ key: "delete-test/file.pdf", body: Buffer.from("data"), contentType: "application/pdf" });

    await store.deleteObject("delete-test/file.pdf");

    await expect(store.getObject("delete-test/file.pdf")).rejects.toThrow();
  });

  it("deleteObject is idempotent on non-existent key", async () => {
    await expect(store.deleteObject("nonexistent/key.pdf")).resolves.toBeUndefined();
  });

  it("full upload → list → retrieve pipeline", async () => {
    const tenantId = "integration-tenant";
    const files = [
      { key: `uploads/${tenantId}/inv-001.pdf`, body: Buffer.from("pdf-001"), contentType: "application/pdf" },
      { key: `uploads/${tenantId}/inv-002.png`, body: Buffer.from("png-002"), contentType: "image/png" }
    ];

    for (const file of files) {
      await store.putObject({ key: file.key, body: file.body, contentType: file.contentType });
    }

    const listed = await store.listObjects(`uploads/${tenantId}`);
    expect(listed.length).toBe(2);

    const retrieved = await store.getObject(`uploads/${tenantId}/inv-001.pdf`);
    expect(Buffer.from(retrieved.body).toString()).toBe("pdf-001");
    expect(retrieved.contentType).toBe("application/pdf");
  });
});
