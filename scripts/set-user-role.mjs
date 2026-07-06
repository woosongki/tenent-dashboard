import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const email = process.argv[2];
const role  = process.argv[3];
if (!email || !["owner", "admin", "member"].includes(role)) {
  console.error("usage: node scripts/set-user-role.mjs <email> <owner|admin|member>");
  process.exit(1);
}

const { data: profile, error: pErr } = await sb
  .from("profiles").select("id, email, full_name").eq("email", email).maybeSingle();
if (pErr || !profile) { console.error("profile lookup failed:", pErr?.message ?? "not found"); process.exit(1); }

const { data, error } = await sb
  .from("organization_members")
  .update({ role })
  .eq("user_id", profile.id)
  .select("user_id, organization_id, role");

if (error) { console.error("update failed:", error.message); process.exit(1); }
console.log(`updated ${profile.email} (${profile.full_name ?? "-"}) →`, data);
