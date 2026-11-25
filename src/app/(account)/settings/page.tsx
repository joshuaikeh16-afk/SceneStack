import { requireProductUser } from "@/lib/product/runtime";
import { SettingsContent } from "@/components/product/settings";
import { PageContainer } from "@/components/layout/page-container";
export const metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};
export default async function Settings() {
  await requireProductUser("/settings");
  return (
    <PageContainer className="account-page settings-page">
      <header className="compact-heading">
        <p className="eyebrow">A FEW THINGS BEHIND THE SCENES</p>
        <h1>Make yourself at home.</h1>
        <p>Your account, your preferences, your peace of mind.</p>
      </header>
      <SettingsContent />
    </PageContainer>
  );
}
