import { S3FileStore } from "@/storage/S3FileStore.js";

describe("S3FileStore", () => {
  describe("constructor validation", () => {
    it("throws when bucket is empty", () => {
      expect(
        () => new S3FileStore({ bucket: "", region: "us-east-1" })
      ).toThrow("S3 file store bucket is required.");
    });

    it("throws when region is empty", () => {
      expect(
        () => new S3FileStore({ bucket: "test-bucket", region: "" })
      ).toThrow("S3 file store region is required.");
    });

    it("throws when bucket is whitespace-only", () => {
      expect(
        () => new S3FileStore({ bucket: "  ", region: "us-east-1" })
      ).toThrow("S3 file store bucket is required.");
    });

    it("throws when region is whitespace-only", () => {
      expect(
        () => new S3FileStore({ bucket: "test-bucket", region: "  " })
      ).toThrow("S3 file store region is required.");
    });
  });

  describe("presigned URL endpoint", () => {
    it("uses public endpoint for presigned URLs when configured", async () => {
      const store = new S3FileStore({
        bucket: "test-bucket",
        region: "us-east-1",
        endpoint: "http://minio:9000",
        publicEndpoint: "http://localhost:9100",
        forcePathStyle: true
      });

      const url = await store.generatePresignedPutUrl("test/file.pdf", "application/pdf", 3600);

      expect(url).toMatch(/^http:\/\/localhost:9100\//);
      expect(url).not.toMatch(/minio:9000/);
    });

    it("uses internal endpoint for presigned URLs when publicEndpoint is not set", async () => {
      const store = new S3FileStore({
        bucket: "test-bucket",
        region: "us-east-1",
        endpoint: "http://minio:9000",
        forcePathStyle: true
      });

      const url = await store.generatePresignedPutUrl("test/file.pdf", "application/pdf", 3600);

      expect(url).toMatch(/^http:\/\/minio:9000\//);
    });

    it("uses internal endpoint when publicEndpoint is empty string", async () => {
      const store = new S3FileStore({
        bucket: "test-bucket",
        region: "us-east-1",
        endpoint: "http://minio:9000",
        publicEndpoint: "",
        forcePathStyle: true
      });

      const url = await store.generatePresignedPutUrl("test/file.pdf", "application/pdf", 3600);

      expect(url).toMatch(/^http:\/\/minio:9000\//);
    });

    it("uses internal endpoint when publicEndpoint is whitespace-only", async () => {
      const store = new S3FileStore({
        bucket: "test-bucket",
        region: "us-east-1",
        endpoint: "http://minio:9000",
        publicEndpoint: "   ",
        forcePathStyle: true
      });

      const url = await store.generatePresignedPutUrl("test/file.pdf", "application/pdf", 3600);

      expect(url).toMatch(/^http:\/\/minio:9000\//);
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
        prefix: "billforge",
        endpoint: "http://minio:9000",
        publicEndpoint: "http://localhost:9100",
        forcePathStyle: true
      });

      const url = await store.generatePresignedPutUrl("uploads/invoice.pdf", "application/pdf", 3600);

      expect(url).toMatch(/^http:\/\/localhost:9100\//);
      expect(url).toContain("billforge");
    });
  });
});
