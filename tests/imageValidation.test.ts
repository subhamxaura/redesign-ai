import { describe, expect, it } from "vitest";
import {
  detectImageType,
  MAX_IMAGE_BYTES,
  readImageDimensions,
  validateImageUpload,
} from "@/app/lib/imageValidation";

function png(width = 800, height = 600): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function jpeg(width = 800, height = 600): Buffer {
  const buffer = Buffer.alloc(21);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  buffer[3] = 0xc0;
  buffer.writeUInt16BE(17, 4);
  buffer[6] = 8;
  buffer.writeUInt16BE(height, 7);
  buffer.writeUInt16BE(width, 9);
  return buffer;
}

function webp(width = 800, height = 600): Buffer {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(22, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

function file(buffer: Buffer, type: string): File {
  return new File([new Uint8Array(buffer)], "upload", { type });
}

describe("detectImageType / readImageDimensions", () => {
  it("detects supported formats by magic bytes", () => {
    expect(detectImageType(png())).toBe("image/png");
    expect(detectImageType(jpeg())).toBe("image/jpeg");
    expect(detectImageType(webp())).toBe("image/webp");
    expect(detectImageType(Buffer.from("GIF89a"))).toBeNull();
  });

  it("reads dimensions for each format", () => {
    expect(readImageDimensions(png(1024, 768), "image/png")).toEqual({
      width: 1024,
      height: 768,
    });
    expect(readImageDimensions(jpeg(1024, 768), "image/jpeg")).toEqual({
      width: 1024,
      height: 768,
    });
    expect(readImageDimensions(webp(1024, 768), "image/webp")).toEqual({
      width: 1024,
      height: 768,
    });
  });
});

describe("validateImageUpload", () => {
  it("accepts valid images", async () => {
    const result = await validateImageUpload(file(png(), "image/png"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe("image/png");
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    }
  });

  it("rejects missing, empty, and unsupported files", async () => {
    expect((await validateImageUpload(null)).ok).toBe(false);
    expect((await validateImageUpload(file(Buffer.alloc(0), "image/png"))).ok).toBe(false);
    expect((await validateImageUpload(file(png(), "image/gif"))).ok).toBe(false);
  });

  it("rejects content that does not match the declared MIME type", async () => {
    const result = await validateImageUpload(file(jpeg(), "image/png"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects spoofed content with a valid extension-only MIME", async () => {
    const result = await validateImageUpload(
      file(Buffer.from("<svg onload=alert(1)>"), "image/png")
    );
    expect(result.ok).toBe(false);
  });

  it("rejects oversized files", async () => {
    const result = await validateImageUpload(
      file(Buffer.alloc(MAX_IMAGE_BYTES + 1, 0), "image/png")
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });

  it("rejects excessive dimensions", async () => {
    const result = await validateImageUpload(file(png(9000, 100), "image/png"));
    expect(result.ok).toBe(false);
  });
});
