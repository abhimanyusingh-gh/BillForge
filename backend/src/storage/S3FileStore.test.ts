import { S3FileStore } from "@/storage/S3FileStore.js";

describe("S3FileStore", () => {
  describe("constructor validation", () => {
    it.each([
      ["bucket empty", { bucket: "", region: "us-east-1" }, "S3 file store bucket is required."],
      ["bucket whitespace-only", { bucket: "  ", region: "us-east-1" }, "S3 file store bucket is required."],
      ["region empty", { bucket: "test-bucket", region: "" }, "S3 file store region is required."],
      ["region whitespace-only", { bucket: "test-bucket", region: "  " }, "S3 file store region is required."],
    ])("throws when %s", (_label, config, expectedError) => {
      expect(() => new S3FileStore(config as ConstructorParameters<typeof S3FileStore>[0])).toThrow(expectedError);
    });
  });

  describe("presigned URL endpoint", () => {
    it.each([
      ["uses public endpoint when configured", "http://localhost:9100", /^http:\/\/localhost:9100\//],
      ["uses internal endpoint when publicEndpoint is not set", undefined, /^http:\/\/minio:9000\//],
      ["uses internal endpoint when publicEndpoint is empty string", "", /^http:\/\/minio:9000\//],
      ["uses internal endpoint when publicEndpoint is whitespace-only", "   ", /^http:\/\/minio:9000\//],
    ])("%s", async (_label, publicEndpoint, expectedPattern) => {
      const store = new S3FileStore({
        bucket: "test-bucket",
        region: "us-east-1",
        endpoint: "http://minio:9000",
        publicEndpoint,
        forcePathStyle: true
      });

      const url = await store.generatePresignedPutUrl("test/file.pdf", "application/pdf", 3600);

      expect(url).toMatch(expectedPattern);
    });

    it("includes key and content type in presigned URL", async () => {
      const store = new S3FileStore({
        bucket: "test-bucket",
        region: "us-east-1",
        endpoint: "http://minio:9000",
        publicEndpoint: "http://localhost:9100",
        forcePathStyle: true
      });

      const url = await store.generatePresignedPutUrl("uploads/invoice.pdf", "application/pdf", 3600);

      expect(url).toContain("uploads/invoice.pdf");
    });

    it("includes prefix in presigned URL key when prefix is set", async () => {
      const store = new S3FileStore({
        bucket: "test-bucket",
        region: "us-east-1",
        prefix: "ledgerbuddy",
        endpoint: "http://minio:9000",
        publicEndpoint: "http://localhost:9100",
        forcePathStyle: true
      });

      const url = await store.generatePresignedPutUrl("uploads/invoice.pdf", "application/pdf", 3600);

      expect(url).toMatch(/^http:\/\/localhost:9100\//);
      expect(url).toContain("ledgerbuddy");
    });
  });
});
