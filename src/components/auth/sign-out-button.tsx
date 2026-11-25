"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      className="button button-secondary"
      type="submit"
      disabled={pending}
      aria-busy={pending}
    >
      <LogOut size={17} aria-hidden="true" />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
export function SignOutButton() {
  return (
    <form action={signOut}>
      <Submit />
    </form>
  );
}
