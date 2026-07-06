import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const email = process.argv[2];
if (!email) { console.error("usage: node scripts/check-user-role.mjs <email>"); process.exit(1); }

const { data: profile, error: pErr } = await sb
  .from("profiles")
  .select("id, email, full_name, is_approved, approved_at, rejected_at, created_at")
  .eq("email", email)
  .maybeSingle();

console.log("profile:", profile, pErr?.message ?? "");

if (!profile) { process.exit(0); }

const { data: mem, error: mErr } = await sb
  .from("organization_members")
  .select("user_id, organization_id, role, hidden_menus")
  .eq("user_id", profile.id);

console.log("memberships:", mem, mErr?.message ?? "");

const { data: orgs, error: oErr } = await sb
  .from("organization_members")
  .select("organization_id, role")
  .in("role", ["owner", "admin"])
  .limit(5);

console.log("existing owner/admin memberships (sample):", orgs, oErr?.message ?? "");
