import { requireProductUser } from "@/lib/product/runtime";
import { Notifications } from "@/components/product/notifications";
import { PageContainer } from "@/components/layout/page-container";
export const metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};
export default async function NotificationPage() {
  await requireProductUser("/notifications");
  return (
    <PageContainer className="account-page narrow-page">
      <header className="compact-heading">
        <p className="eyebrow">A LITTLE FROM YOUR UNIVERSE</p>
        <h1>Your updates.</h1>
      </header>
      <Notifications page />
    </PageContainer>
  );
}
