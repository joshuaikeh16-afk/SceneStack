"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  let failed = false;
  if (supabase) {
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      failed = Boolean(error);
    } catch {
      failed = true;
    }
  }
  if (failed) redirect("/login?error=signout");
  redirect("/login?signed_out=1");
}
