import { redirect } from "next/navigation";
import { requireProductUser } from "@/lib/product/runtime";
import { getDeletionState } from "@/lib/data/account";
import { Recovery } from "@/components/product/recovery";
import { DataNotice } from "@/components/product/availability";
import { PageContainer } from "@/components/layout/page-container";
export const metadata = {
  title: "Account recovery",
  robots: { index: false, follow: false },
};
export default async function RecoveryPage() {
  const data = await requireProductUser("/account/recovery", {
    onboarding: false,
    allowInactive: true,
  });
  if (data.profile?.status === "active") redirect("/library");
  let until = null;
  try {
    until = (await getDeletionState())?.recover_until ?? null;
  } catch {}
  return (
    <PageContainer className="account-page narrow-page">
      <DataNotice state={data.availability} />
      <Recovery until={until} />
    </PageContainer>
  );
}
