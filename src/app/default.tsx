import { notFound } from "next/navigation";
// The implicit children slot must cover sibling handler URLs; unknown pages remain 404.
export default function Default() {
  notFound();
}
