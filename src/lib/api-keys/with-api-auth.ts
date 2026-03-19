import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "./auth";
import { checkRateLimit } from "./rate-limit";

type AuthContext = {
  userId: string;
  keyId: string;
  params: Record<string, string>;
};

type Handler = (req: NextRequest, ctx: AuthContext) => Promise<NextResponse>;

export function withApiAuth(handler: Handler) {
  return async (req: NextRequest, routeCtx: { params: Promise<Record<string, string>> }) => {
    const auth = await validateApiKey(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Invalid or missing API key" },
        { status: 401 }
      );
    }

    const rate = await checkRateLimit(auth.keyId);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": String(rate.remaining),
            "X-RateLimit-Reset": String(rate.reset),
          },
        }
      );
    }

    const params = await routeCtx.params;
    return handler(req, { ...auth, params });
  };
}
