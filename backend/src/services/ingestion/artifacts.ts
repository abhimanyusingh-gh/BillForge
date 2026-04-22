import { createHash } from "node:crypto";
import path from "node:path";
import type { FileStore } from "@/core/interfaces/FileStore.js";
import type { IngestedFile } from "@/core/interfaces/IngestionSource.js";
import type { OcrPageImage } from "@/core/interfaces/OcrProvider.js";
import { DOCUMENT_MIME_TYPE, type DocumentMimeType } from "@/types/mime.js";

export interface ArtifactResults {
  previewImagePaths: Record<string, string>;
}

export async function persistFieldArtifacts(input: {
  file: IngestedFile;
  mimeType: DocumentMimeType;
  extraction: {
    ocrPageImages: OcrPageImage[];
    metadata: Record<string, string>;
  };
  fileStore?: FileStore;
}): Promise<ArtifactResults> {
  const artifactPrefix = buildArtifactPrefix(input.file);

  const previewImagePaths = input.fileStore
    ? await persistPreviewImages({
        file: input.file,
        mimeType: input.mimeType,
        images: input.extraction.ocrPageImages,
        keyPrefix: `${artifactPrefix}/previews`,
        fileStore: input.fileStore
      })
    : {};

  return { previewImagePaths };
}

function buildArtifactPrefix(file: IngestedFile): string {
  const hash = createHash("sha1")
    .update(`${file.tenantId}:${file.sourceKey}:${file.sourceDocumentId}:${file.attachmentName}`)
    .digest("hex")
    .slice(0, 16);
  return path.join(file.tenantId, file.sourceKey, hash);
}

async function persistPreviewImages(input: {
  file: IngestedFile;
  mimeType: DocumentMimeType;
  images: OcrPageImage[];
  keyPrefix: string;
  fileStore: FileStore;
}): Promise<Record<string, string>> {
  if (input.images.length === 0 && !input.mimeType.startsWith("image/")) {
    return {};
  }

  const output: Record<string, string> = {};
  if (input.mimeType.startsWith("image/")) {
    const extension = extensionForMimeType(input.mimeType);
    const objectRef = await input.fileStore.putObject({
      key: `${input.keyPrefix}/page-1.${extension}`,
      body: input.file.buffer,
      contentType: input.mimeType,
      metadata: {
        tenantId: input.file.tenantId,
        sourceKey: input.file.sourceKey,
        sourceDocumentId: input.file.sourceDocumentId
      }
    });
    output["1"] = objectRef.path;
  }

  for (const image of input.images) {
    const parsed = decodeDataUrl(image.dataUrl);
    if (!parsed) {
      continue;
    }

    const extension = extensionForMimeType(parsed.mimeType);
    const objectRef = await input.fileStore.putObject({
      key: `${input.keyPrefix}/page-${image.page}.${extension}`,
      body: parsed.buffer,
      contentType: parsed.mimeType,
      metadata: {
        tenantId: input.file.tenantId,
        sourceKey: input.file.sourceKey,
        sourceDocumentId: input.file.sourceDocumentId
      }
    });
    output[String(image.page)] = objectRef.path;
  }

  return output;
}

function decodeDataUrl(value: string): { mimeType: string; buffer: Buffer } | undefined {
  const separatorIndex = value.indexOf(",");
  if (separatorIndex < 0) {
    return undefined;
  }

  const header = value.slice(0, separatorIndex);
  const payload = value.slice(separatorIndex + 1);
  const mimeMatch = /^data:([^;]+);base64$/i.exec(header.trim());
  if (!mimeMatch) {
    return undefined;
  }

  try {
    return {
      mimeType: mimeMatch[1].toLowerCase(),
      buffer: Buffer.from(payload, "base64")
    };
  } catch {
    return undefined;
  }
}

function extensionForMimeType(value: string): string {
  if (value === DOCUMENT_MIME_TYPE.JPEG || value === "image/jpg") {
    return "jpg";
  }
  return "png";
}
