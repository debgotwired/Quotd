import crypto from "crypto";

export function signPayload(payload: string, secret: string): string {
  return (
    "sha256=" +
    crypto.createHmac("sha256", secret).update(payload).digest("hex")
  );
}
