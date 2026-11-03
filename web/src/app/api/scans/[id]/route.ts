import { deleteScan } from "@/features/history/data";
import { createClient, currentUser } from "@/lib/supabase/server";

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) {
    return Response.json({ code: "unauthorized" }, { status: 401 });
  }

  const { id } = await props.params;
  const supabase = await createClient();
  const result = await deleteScan(supabase, user.id, id);

  if (!result.ok) {
    if (result.notFound || result.error === "not_found") {
      return Response.json({ code: "not_found" }, { status: 404 });
    }
    return Response.json({ code: "storage_error" }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
