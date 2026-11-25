import Link from "next/link";
import { ShieldAlert } from "lucide-react";
export default function Forbidden() {
  return (
    <section className="control-gate">
      <ShieldAlert size={32} />
      <h1>Access denied</h1>
      <p>
        Your SceneStack account does not have permission to open this workspace.
      </p>
      <Link className="button button-secondary" href="/">
        Return to SceneStack
      </Link>
    </section>
  );
}
