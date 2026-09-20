import { createClient } from "@supabase/supabase-js";
export function createAdmin(env = process.env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
export async function result(query) {
  const { data, error } = await query;
  if (error) throw new Error("Database operation failed");
  return data;
}
export const connectionFields =
  "id,workspace_id,provider,label,status,last_synced_at,has_more";
export const runFields =
  "id,connection_id,status,reviewed_count,skipped_count,has_more,error,started_at,finished_at";
export async function workspaceFor(db, userId) {
  return result(
    db
      .from("product_workspaces")
      .select("id,name,lens")
      .eq("owner_id", userId)
      .maybeSingle(),
  );
}
export async function publicConnections(db, workspaceId) {
  return result(
    db
      .from("product_connections")
      .select(connectionFields)
      .eq("workspace_id", workspaceId)
      .order("created_at"),
  );
}
