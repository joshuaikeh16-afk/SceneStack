import { forbidden, redirect } from "next/navigation";
import { controlContext } from "@/lib/control/runtime";
import { DataAccessError } from "@/lib/data/errors";
import { ControlShell } from "@/components/control/shell";
import Link from "next/link";
export const metadata = {
  title: "Control Center",
  robots: { index: false, follow: false },
};
export default async function ControlLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let context;
  try {
    context = await controlContext();
  } catch (error) {
    if (error instanceof DataAccessError) {
      if (error.code === "AUTH_REQUIRED") redirect("/login?next=%2Fadmin");
      if (error.code === "FORBIDDEN") forbidden();
      return (
        <section className="control-gate">
          <p className="eyebrow">SCENESTACK CONTROL CENTER</p>
          <h1>Administration is unavailable</h1>
          <p>{error.message}</p>
          <p>
            Deploy the reviewed Control Center migrations 025–031 to the
            configured Supabase project, reload its API schema cache, then
            retry.
          </p>
          <Link className="button button-secondary" href="/">
            Return to SceneStack
          </Link>
        </section>
      );
    }
    throw error;
  }
  const { identity, user } = context;
  return (
    <ControlShell
      identity={identity}
      name={
        typeof user.user_metadata.full_name === "string"
          ? user.user_metadata.full_name
          : "Administrator"
      }
    >
      {children}
    </ControlShell>
  );
}
