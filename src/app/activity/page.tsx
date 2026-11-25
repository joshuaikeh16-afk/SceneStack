import { requireProductUser } from "@/lib/product/runtime";
import { PageContainer } from "@/components/layout/page-container";
import { TeamInvitations } from "@/components/product/team-invitations";
export const metadata = {
  title: "Team invitations",
  robots: { index: false, follow: false },
};
export default async function Activity() {
  await requireProductUser("/activity");
  return (
    <PageContainer className="account-page narrow-page">
      <h1>Team invitations</h1>
      <TeamInvitations />
    </PageContainer>
  );
}
