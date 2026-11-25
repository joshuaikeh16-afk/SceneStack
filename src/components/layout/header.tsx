import Link from "next/link";
import Image from "next/image";
import { Search, Settings } from "lucide-react";
import { Brand } from "./brand";
import { PrimaryNav } from "@/components/navigation/primary-nav";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { NotificationMenu } from "@/components/navigation/notification-menu";
import { getBootstrap } from "@/lib/product/runtime";

export async function Header() {
  const bootstrap = await getBootstrap();
  const user = bootstrap.userId;
  const name = bootstrap.profile?.display_name || bootstrap.name;
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <PrimaryNav />
        <div className="header-actions">
          <Link
            className="header-search"
            href="/discover"
            aria-label="Search entertainment titles"
          >
            <Search size={18} strokeWidth={1.6} aria-hidden="true" />
            <span>Find a story</span>
          </Link>
          {user ? (
            <>
              <NotificationMenu />
              <Link
                className="icon-button header-settings"
                href="/settings"
                aria-label="Account settings"
              >
                <Settings size={18} strokeWidth={1.6} />
              </Link>
              <Link
                className="avatar-link"
                href="/profile"
                aria-label="Your profile"
              >
                {bootstrap.profile?.avatar_path ? (
                  <Image
                    unoptimized
                    className="header-avatar-image"
                    src={`/api/assets/scenestack-avatars/${bootstrap.profile.avatar_path.split("/").map(encodeURIComponent).join("/")}`}
                    alt=""
                    width={34}
                    height={34}
                  />
                ) : (
                  <Avatar name={name} />
                )}
              </Link>
            </>
          ) : (
            <ButtonLink
              href="/login"
              variant="secondary"
              className="header-signin"
            >
              Sign in
            </ButtonLink>
          )}
        </div>
      </div>
    </header>
  );
}
