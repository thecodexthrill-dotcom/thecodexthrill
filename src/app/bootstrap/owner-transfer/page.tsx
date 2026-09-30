import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { transferSuperAdminSlotToOwnerAction } from "@/lib/supabase/actions";

export const metadata: Metadata = { title: "Confirm owner access transfer", robots: { index: false, follow: false } };

export default async function OwnerTransferPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error: requestedError } = await searchParams;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !user.invited_at || !user.email_confirmed_at) redirect("/access-denied");
  const { data: candidate } = await supabase.rpc("is_owner_super_admin_transfer_candidate");
  if (!candidate) redirect("/access-denied");
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") redirect("/mfa?next=%2Fbootstrap%2Fowner-transfer");

  return <main className="auth-page"><section className="auth-card">
    <p className="eyebrow"><span />OWNER ACCESS TRANSFER</p>
    <h1>Confirm your Super Admin access.</h1>
    <p className="auth-description">This invitation is owner-authorized. Continuing transfers the existing Super Admin designation to your verified, MFA-protected account. The current holder remains in Auth but loses Super Admin access. The single designation is updated atomically and audited.</p>
    {requestedError && <p className="module-alert" role="alert">The transfer was not completed. Confirm the invitation is current and MFA is verified, then retry or ask the local operator to reauthorize it.</p>}
    <form action={transferSuperAdminSlotToOwnerAction}><button className="button-gold" type="submit">Transfer existing Super Admin access</button></form>
  </section></main>;
}