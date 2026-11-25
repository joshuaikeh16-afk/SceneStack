import { redirect } from "next/navigation";
import { requireProductUser } from "@/lib/product/runtime";
import { getPreferences } from "@/lib/data/profiles";
import { safeRedirect } from "@/lib/utils/redirect";
import { OnboardingWizard } from "@/components/product/onboarding";
import { PageContainer } from "@/components/layout/page-container";
export const metadata = {
  title: "Welcome to your universe",
  robots: { index: false, follow: false },
};
export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeRedirect((await searchParams).next);
  const data = await requireProductUser(next, { onboarding: false });
  if (data.onboarding?.completed_at) redirect(next);
  let prefs = null;
  try {
    if (data.availability === "ready") prefs = await getPreferences();
  } catch {}
  return (
    <PageContainer className="account-page">
      <OnboardingWizard next={next} initial={prefs} />
    </PageContainer>
  );
}
