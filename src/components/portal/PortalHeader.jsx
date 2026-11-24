"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function PortalHeader({ displayName, role }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const { error: signOutError } = await createSupabaseBrowserClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setError("Unable to sign out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <header className="portal-header">
      <Link className="brand" href="/"><span className="brand-mark"><ShieldCheck size={17} /></span><span>CIPHER<span>BRIEF</span></span></Link>
      <div className="portal-account">
        <span>{displayName}<small>{role}</small></span>
        <Link href="/profile">Profile</Link>
        <button type="button" onClick={signOut} disabled={busy}><LogOut size={15} />{busy ? "Signing out..." : "Sign out"}</button>
      </div>
      {error && <span className="portal-header-error" role="alert">{error}</span>}
    </header>
  );
}
