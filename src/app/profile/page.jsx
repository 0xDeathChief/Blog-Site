import PortalFrame from "@/components/portal/PortalFrame";
import ProfileSettingsForm from "@/components/profile/ProfileSettingsForm";
import { requireArticlePage } from "@/lib/articles/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Profile settings — MadQuill" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const principal = await requireArticlePage(["owner", "editor", "contributor", "reader"], "/profile");
  const supabase = await createSupabaseServerClient();
  const { data: profile, error } = await supabase.from("profiles")
    .select("display_name:full_name, username, bio, avatar_url, role, created_at")
    .eq("id", principal.id).single();
  if (error) throw new Error("Unable to load your profile.", { cause: error });
  const area = principal.role === "owner" ? "owner"
    : principal.role === "editor" ? "editor"
      : principal.role === "contributor" ? "contributor"
        : "reader";

  return (
    <PortalFrame principal={principal} area={area} title="Profile settings" description="Manage the public name associated with your MadQuill activity.">
      <section className="portal-card">
        <p className="profile-meta">Account role: <strong>{profile.role}</strong> · Member since {new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(profile.created_at))}</p>
        <ProfileSettingsForm displayName={profile.display_name} username={profile.username} bio={profile.bio} avatarUrl={profile.avatar_url} />
      </section>
    </PortalFrame>
  );
}
