import { requireProductUser } from "@/lib/product/runtime";
import { publicProfile } from "@/lib/product/queries";
import { CreatorProfile } from "@/components/product/profile";
import { PageContainer } from "@/components/layout/page-container";
export const metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};
export default async function Profile() {
  const data = await requireProductUser("/profile");
  const profile =
    data.availability === "ready" ? await publicProfile(data.userId) : null;
  return (
    <PageContainer className="account-page profile-page">
      <CreatorProfile initial={profile} own />
    </PageContainer>
  );
}
