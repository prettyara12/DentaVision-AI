import { connection } from "next/server";
import { inferenceStatus } from "@/lib/inference";

// Lets the browser show `waking` while a sleeping HF Space boots (docs/user-flows.md §3).
export async function GET() {
  // Without this the handler is prerendered at build time and always answers the build's status.
  await connection();
  return Response.json(
    { status: await inferenceStatus() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
