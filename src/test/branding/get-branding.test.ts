import { describe, it, expect, vi } from "vitest";
import { getBrandingForInterview } from "@/lib/branding/get-branding";

describe("getBrandingForInterview", () => {
  const mockSupabase = (profileData: Record<string, unknown> | null) => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: profileData,
            error: profileData ? null : { message: "not found" },
          }),
        }),
      }),
    }),
  });

  it("returns profile branding when profile exists", async () => {
    const supabase = mockSupabase({
      logo_url: "https://example.com/logo.png",
      primary_color: "#ff0000",
      welcome_message: "Hello!",
      company_name: "Acme Corp",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getBrandingForInterview(supabase as any, "user-123");

    expect(result).toEqual({
      logo_url: "https://example.com/logo.png",
      primary_color: "#ff0000",
      welcome_message: "Hello!",
      company_name: "Acme Corp",
    });
  });

  it("returns defaults when profile not found", async () => {
    const supabase = mockSupabase(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getBrandingForInterview(supabase as any, "user-123");

    expect(result).toEqual({
      logo_url: null,
      primary_color: "#1a1a1a",
      welcome_message: null,
      company_name: "",
    });
  });

  it("handles partial profile data", async () => {
    const supabase = mockSupabase({
      logo_url: null,
      primary_color: null,
      welcome_message: null,
      company_name: "TestCo",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getBrandingForInterview(supabase as any, "user-123");

    expect(result.primary_color).toBe("#1a1a1a");
    expect(result.logo_url).toBeNull();
    expect(result.welcome_message).toBeNull();
    expect(result.company_name).toBe("TestCo");
  });
});
