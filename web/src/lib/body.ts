const fail = (status: number, code: string) => Response.json({ code }, { status });

/**
 * Reads a request body of at most `maxBytes`. Content-Length gives the early 411/413, but the cap is
 * enforced on the bytes actually read, so a client that under-declares cannot send more.
 * The returned `body` keeps the request's Content-Type, so `.json()` and `.formData()` still work.
 */
export async function readBody(
  request: Request,
  maxBytes: number,
): Promise<{ body: Response } | { error: Response }> {
  const declared = request.headers.get("content-length");
  if (!declared || !/^\d+$/.test(declared)) return { error: fail(411, "length_required") };
  if (Number(declared) > maxBytes) return { error: fail(413, "too_large") };

  const chunks: Uint8Array[] = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (let read = await reader.read(); !read.done; read = await reader.read()) {
      size += read.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { error: fail(413, "too_large") };
      }
      chunks.push(read.value);
    }
  }
  const bytes = new Uint8Array(size);
  chunks.reduce((offset, chunk) => (bytes.set(chunk, offset), offset + chunk.byteLength), 0);
  const type = request.headers.get("content-type");
  return { body: new Response(bytes, type ? { headers: { "content-type": type } } : {}) };
}
