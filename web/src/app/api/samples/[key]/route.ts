import { samples, type SampleKey } from "@/features/scan/samples";
import impacted from "@/features/scan/samples/impacted.json";
import missing from "@/features/scan/samples/missing.json";
import restorations from "@/features/scan/samples/restorations.json";

const results: Record<SampleKey, unknown> = { impacted, restorations, missing };

// Prerendered at build time for every sample: no inference call, no quota (docs/PRD.md US-01).
export function generateStaticParams() {
  return samples.map(({ key }) => ({ key }));
}

export async function GET(_request: Request, { params }: RouteContext<"/api/samples/[key]">) {
  const { key } = await params;
  const result = Object.hasOwn(results, key) ? results[key as SampleKey] : undefined;
  return result ? Response.json(result) : Response.json({ code: "not_found" }, { status: 404 });
}
