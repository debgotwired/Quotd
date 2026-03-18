import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "./logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_name")
    .eq("user_id", user.id)
    .single();

  // If no profile, redirect to onboarding (middleware should catch this, but just in case)
  if (!profile) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-lg font-semibold text-gray-900">
            Quotd
          </Link>
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link href="/dashboard/team" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Team
            </Link>
            <Link href="/dashboard/settings" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Settings
            </Link>
            <span className="text-sm text-gray-400 truncate">{profile.full_name}</span>
            <LogoutButton />
          </div>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">{children}</main>
    </div>
  );
}
