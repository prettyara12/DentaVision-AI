import { deleteAccount } from "@/features/history/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, currentUser } from "@/lib/supabase/server";

export async function DELETE() {
  const user = await currentUser();
  if (!user) {
    return Response.json({ code: "unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const adminClient = createAdminClient();
  const result = await deleteAccount(adminClient, supabase, user.id);

  if (!result.ok) {
    return Response.json({ code: "storage_error" }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
