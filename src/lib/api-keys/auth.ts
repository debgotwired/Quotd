import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

export async function validateApiKey(
  request: Request
): Promise<{ userId: string; keyId: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer qtd_")) return null;

  const rawKey = authHeader.slice(7);
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("api_keys")
    .select("id, user_id, expires_at")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .single();

  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  // Update last_used_at (fire and forget)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return { userId: data.user_id, keyId: data.id };
}
