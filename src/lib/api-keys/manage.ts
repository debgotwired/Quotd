import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

export async function createApiKey(userId: string, name: string) {
  const rawKey = "qtd_" + crypto.randomBytes(32).toString("hex");
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12);

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: userId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
    })
    .select("id, name, key_prefix, created_at")
    .single();

  if (error) throw error;
  return { ...data, key: rawKey }; // raw key shown ONCE
}

export async function listApiKeys(userId: string) {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, created_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return data || [];
}

export async function revokeApiKey(userId: string, keyId: string) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("user_id", userId);

  if (error) throw error;
}
