import { notFound } from "next/navigation";
import { idSchema } from "@/lib/validation/data";
import { requireProductUser } from "@/lib/product/runtime";
import { collectionDetails } from "@/lib/product/queries";
import { CollectionDetail } from "@/components/product/collection-detail";
import { DataNotice } from "@/components/product/availability";
import { PageContainer } from "@/components/layout/page-container";
export const metadata = {
  title: "Collection",
  robots: { index: false, follow: false },
};
export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const bootstrap = await requireProductUser(`/collections/${id}`);
  if (bootstrap.availability !== "ready")
    return (
      <PageContainer className="account-page">
        <DataNotice state={bootstrap.availability} />
      </PageContainer>
    );
  const data = await collectionDetails(id);
  if (!data) notFound();
  return (
    <PageContainer className="account-page collection-page">
      <CollectionDetail initial={data} />
    </PageContainer>
  );
}
