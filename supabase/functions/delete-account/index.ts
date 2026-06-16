import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

// SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are
// automatically injected by the Supabase Edge Function runtime — no manual secrets needed.

Deno.serve(async (req: Request) => {
  // React Native doesn't enforce CORS, but add headers for any web callers.
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    // ── 1. Extract and verify the caller's JWT ────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    // Build a user-scoped client so .auth.getUser() validates the JWT against
    // Supabase's auth service — this is the canonical way to verify JWTs in
    // Edge Functions without importing a JWT library.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("[delete-account] JWT verification failed:", userError?.message);
      return json({ error: "Invalid or expired token" }, 401);
    }

    const userId = user.id;
    console.log(`[delete-account] Request received for user ${userId}`);

    // ── 2. Build admin client (service role — bypasses RLS) ───────────────────
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ── 3. Delete Storage objects under profile-pictures/{userId}/ ────────────
    // Must happen before auth deletion — Storage has no FK cascade from auth.users.
    const { data: storageObjects, error: listError } = await admin.storage
      .from("profile-pictures")
      .list(userId);

    if (listError) {
      console.error(`[delete-account] Storage list failed for ${userId}:`, listError.message);
      return json({ error: `Storage listing failed: ${listError.message}` }, 500);
    }

    if (storageObjects && storageObjects.length > 0) {
      const paths = storageObjects.map((obj) => `${userId}/${obj.name}`);
      const { error: removeError } = await admin.storage
        .from("profile-pictures")
        .remove(paths);

      if (removeError) {
        console.error(`[delete-account] Storage remove failed for ${userId}:`, removeError.message);
        return json({ error: `Storage deletion failed: ${removeError.message}` }, 500);
      }
      console.log(`[delete-account] Removed ${paths.length} storage file(s) for ${userId}`);
    } else {
      console.log(`[delete-account] No storage files found for ${userId}`);
    }

    // ── 4. Delete auth user ───────────────────────────────────────────────────
    // PostgreSQL ON DELETE CASCADE handles the rest:
    //   auth.users → profiles, exercises (→ set_entries), notes
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error(`[delete-account] Auth deletion failed for ${userId}:`, deleteError.message);
      // Storage was already deleted at this point; log clearly for manual cleanup if needed.
      return json({ error: `Account deletion failed: ${deleteError.message}` }, 500);
    }

    console.log(`[delete-account] Account fully deleted for user ${userId}`);
    return json({ success: true });
  } catch (err) {
    console.error("[delete-account] Unexpected error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
