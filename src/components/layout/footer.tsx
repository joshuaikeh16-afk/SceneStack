import Link from "next/link";
import { Brand } from "./brand";
export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Brand />
        <p>Your entertainment. Your universe.</p>
      </div>
      <div className="footer-links">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/credits">Credits</Link>
      </div>
    </footer>
  );
}
