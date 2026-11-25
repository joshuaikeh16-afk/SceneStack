import { Wrench } from "lucide-react";

export function SetupNotice() {
  return (
    <div className="setup-notice" role="status">
      <Wrench size={20} aria-hidden="true" />
      <div>
        <h2>One quick setup before sign-in</h2>
        <p>
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and a current{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> (
          <code>sb_publishable_…</code>) to <code>.env.local</code>, enable
          Google in Supabase, then restart the app.
        </p>
        <p>
          The project README has the full setup steps. You can explore the home
          page in the meantime.
        </p>
      </div>
    </div>
  );
}
