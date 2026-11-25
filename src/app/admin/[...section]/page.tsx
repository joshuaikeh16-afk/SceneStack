import { forbidden, notFound, redirect } from "next/navigation";
import { controlModule } from "@/config/control-center";
import { controlContext } from "@/lib/control/runtime";
import { ControlWorkspace } from "@/components/control/workspace";
import { z } from "zod";
import { DataAccessError } from "@/lib/data/errors";
export default async function AdminSection({
  params,
}: {
  params: Promise<{ section: string[] }>;
}) {
  const { section } = await params;
  const activeModule = controlModule(section[0]);
  if (
    !activeModule ||
    section.length > 2 ||
    (section[1] && !z.uuid().safeParse(section[1]).success)
  )
    notFound();
  if (
    section[1] &&
    ![
      "users",
      "catalog",
      "action-center",
      "reports",
      "appeals",
      "support",
      "title-requests",
      "corrections",
    ].includes(activeModule.slug)
  )
    notFound();
  try {
    await controlContext(activeModule.slug);
  } catch (error) {
    if (error instanceof DataAccessError && error.code === "FORBIDDEN")
      forbidden();
    if (error instanceof DataAccessError && error.code === "AUTH_REQUIRED")
      redirect(
        `/login?next=${encodeURIComponent(`/admin/${section.join("/")}`)}`,
      );
    if (error instanceof DataAccessError && error.code === "SETUP_REQUIRED")
      return (
        <section className="control-gate">
          <h1>Administration is unavailable</h1>
          <p>
            Control Center migrations 025–031 must be deployed to the configured
            Supabase project.
          </p>
        </section>
      );
    throw error;
  }
  return <ControlWorkspace section={activeModule.slug} detailId={section[1]} />;
}
