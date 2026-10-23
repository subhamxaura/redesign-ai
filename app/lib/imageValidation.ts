export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 8_192;
export const MAX_IMAGE_PIXELS = 40_000_000;

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type SupportedImageType = "image/png" | "image/jpeg" | "image/webp";

export type ImageDimensions = { width: number; height: number };

export type ImageValidationResult =
  | {
      ok: true;
      file: File;
      buffer: Buffer;
      mimeType: SupportedImageType;
      width: number;
      height: number;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

function fail(error: string, status = 400): ImageValidationResult {
  return { ok: false, error, status };
}

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

export function detectImageType(buffer: Buffer): SupportedImageType | null {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function readPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24) return null;
  if (buffer.toString("ascii", 12, 16) !== "IHDR") return null;

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width === 0 || height === 0) return null;
  return { width, height };
}

const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
  let offset = 2;
  let segments = 0;

  while (offset + 4 <= buffer.length && segments < 512) {
    segments += 1;

    if (buffer[offset] !== 0xff) return null;
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) return null;

    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;

    if (offset + 2 > buffer.length) return null;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;

    if (JPEG_SOF_MARKERS.has(marker)) {
      if (segmentLength < 7) return null;
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (width === 0 || height === 0) return null;
      return { width, height };
    }

    offset += segmentLength;
  }

  return null;
}

function readWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 30) return null;
  const chunkType = buffer.toString("ascii", 12, 16);

  if (chunkType === "VP8X") {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }

  if (chunkType === "VP8 ") {
    if (!startsWith(buffer, [0x9d, 0x01, 0x2a], 23)) return null;
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    if (width === 0 || height === 0) return null;
    return { width, height };
  }

  if (chunkType === "VP8L") {
    if (buffer[20] !== 0x2f) return null;
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return { width, height };
  }

  return null;
}

export function readImageDimensions(
  buffer: Buffer,
  mimeType: SupportedImageType
): ImageDimensions | null {
  if (mimeType === "image/png") return readPngDimensions(buffer);
  if (mimeType === "image/jpeg") return readJpegDimensions(buffer);
  return readWebpDimensions(buffer);
}

/**
 * Validate type, magic bytes, declared-vs-actual MIME, byte size and
 * dimensions. The File MIME type is client-controlled and is never trusted
 * on its own.
 */
export async function validateImageUpload(value: FormDataEntryValue | null): Promise<ImageValidationResult> {
  if (!(value instanceof File)) {
    return fail("No image uploaded.");
  }

  if (!ALLOWED_IMAGE_TYPES.has(value.type)) {
    return fail("Please upload a PNG, JPG, or WEBP image.");
  }

  if (value.size === 0) {
    return fail("The uploaded image is empty.");
  }

  if (value.size > MAX_IMAGE_BYTES) {
    return fail(`Image must be smaller than ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.`, 413);
  }

  const buffer = Buffer.from(await value.arrayBuffer());
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) {
    return fail(`Image must be smaller than ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.`, 413);
  }

  const actualType = detectImageType(buffer);
  if (!actualType) {
    return fail("The uploaded file is not a valid PNG, JPG, or WEBP image.");
  }

  if (actualType !== value.type) {
    return fail("The uploaded file content does not match its declared image type.");
  }

  const dimensions = readImageDimensions(buffer, actualType);
  if (!dimensions) {
    return fail("The image dimensions could not be read or the image is corrupt.");
  }

  if (
    dimensions.width > MAX_IMAGE_DIMENSION ||
    dimensions.height > MAX_IMAGE_DIMENSION ||
    dimensions.width * dimensions.height > MAX_IMAGE_PIXELS
  ) {
    return fail(
      `Image dimensions must be at most ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} and ${MAX_IMAGE_PIXELS} pixels total.`
    );
  }

  return {
    ok: true,
    file: value,
    buffer,
    mimeType: actualType,
    width: dimensions.width,
    height: dimensions.height,
  };
}

export function fileToInlineData(buffer: Buffer, mimeType: string) {
  return {
    inlineData: {
      mimeType,
      data: buffer.toString("base64"),
    },
  };
}
