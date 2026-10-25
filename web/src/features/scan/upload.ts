// Browser-side limits for the original file (docs/PRD.md US-02). The server re-checks the compressed upload.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png"] as const;
export const MAX_SIDE = 2048;
const JPEG_QUALITY = 0.9;

export type FileProblem = "unsupported_type" | "too_large";

export function checkFile(file: { type: string; size: number }): FileProblem | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return "unsupported_type";
  if (file.size > MAX_FILE_BYTES) return "too_large";
  return null;
}

/** Scale (width, height) so the longest side is at most `max`, never upscaling. */
export function fitWithin(width: number, height: number, max = MAX_SIDE): [number, number] {
  const scale = Math.min(1, max / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

/** Longest side 2048 px, JPEG 0.9, EXIF orientation applied. Throws if the image cannot be decoded. */
export async function compressImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const [width, height] = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is not available");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("JPEG encoding failed"))),
      "image/jpeg",
      JPEG_QUALITY,
    ),
  );
}

export function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Parse an NDJSON body into objects as lines arrive, including lines split across chunks. */
export async function* readLines<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = done ? "" : (lines.pop() ?? "");
      for (const line of lines) if (line.trim()) yield JSON.parse(line) as T;
      if (done) return;
    }
  } finally {
    // Also runs on invalid JSON or when the consumer stops early; closes the connection.
    await reader.cancel().catch(() => {});
  }
}
