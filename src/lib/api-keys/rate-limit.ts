import { createServiceClient } from "@/lib/supabase/server";

const LIMIT = 100;

export async function checkRateLimit(
  keyId: string
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const supabase = await createServiceClient();

  const windowStart = new Date();
  windowStart.setSeconds(0, 0); // Round to minute
  const windowKey = windowStart.toISOString();

  // Try to fetch existing window
  const { data: existing } = await supabase
    .from("api_rate_limits")
    .select("request_count")
    .eq("key_hash", keyId)
    .eq("window_start", windowKey)
    .single();

  const newCount = (existing?.request_count || 0) + 1;

  // Upsert the counter
  await supabase.from("api_rate_limits").upsert(
    { key_hash: keyId, window_start: windowKey, request_count: newCount },
    { onConflict: "key_hash,window_start" }
  );

  const remaining = Math.max(0, LIMIT - newCount);
  const reset = Math.ceil((windowStart.getTime() + 60000) / 1000);

  return { allowed: newCount <= LIMIT, remaining, reset };
}
