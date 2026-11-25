import { notFound } from "next/navigation";
import { getTitleDetails } from "@/lib/product/queries";
import { TitleRouteModal } from "@/components/product/title-route-modal";
export default async function TitleModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let details;
  try {
    details = await getTitleDetails((await params).id);
  } catch {
    throw new Error("This title is temporarily unavailable. Please try again.");
  }
  if (!details) notFound();
  return <TitleRouteModal details={details} />;
}
