import { notFound, redirect } from "next/navigation";
import { requireProductUser } from "@/lib/product/runtime";
import { publicProfile } from "@/lib/product/queries";
import { CreatorProfile } from "@/components/product/profile";
import { PageContainer } from "@/components/layout/page-container";
import { DataNotice } from "@/components/product/availability";
export const metadata = {
  title: "Creator",
  robots: { index: false, follow: false },
};
export default async function Creator({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const user = await requireProductUser(`/people/${username}`);
  if (user.availability !== "ready")
    return (
      <PageContainer className="account-page">
        <DataNotice state={user.availability} />
      </PageContainer>
    );
  const data = await publicProfile(username);
  if (!data) notFound();
  if (data.profile.id === user.userId) redirect("/profile");
  return (
    <PageContainer className="account-page profile-page">
      <CreatorProfile initial={data} />
    </PageContainer>
  );
}
