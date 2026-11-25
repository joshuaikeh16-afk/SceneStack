import { Globe2, Settings2, PenLine } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
export function ProfileHeader({
  displayName,
  username = null,
  bio = null,
  isOwner = false,
  followers = null,
  following = null,
}: {
  displayName: string;
  username?: string | null;
  bio?: string | null;
  isOwner?: boolean;
  followers?: number | null;
  following?: number | null;
}) {
  return (
    <header className="profile-header">
      <div className="profile-banner" aria-hidden="true">
        <span>EVERY STORY LEAVES A LITTLE OF ITSELF WITH US.</span>
      </div>
      <div className="profile-identity">
        <Avatar name={displayName} size="large" />
        <div className="profile-main">
          <div className="profile-name-row">
            <h1>{displayName}</h1>
            {!username && <Badge>Profile setup pending</Badge>}
          </div>
          <p className="profile-username">
            {username
              ? `@${username}`
              : "Your permanent username is waiting to be chosen."}
          </p>
          <p className="profile-bio">
            {bio || "A new perspective. A whole world of stories ahead."}
          </p>
          <div className="profile-public">
            <Globe2 size={14} aria-hidden="true" />
            <span>Public to signed-in members</span>
            {followers !== null && <span>{followers} followers</span>}
            {following !== null && <span>{following} following</span>}
          </div>
        </div>
        {isOwner && (
          <div className="profile-owner-actions">
            <ButtonLink href="#profile-setup" variant="secondary">
              <PenLine size={15} aria-hidden="true" />
              {username ? "Edit profile" : "Set up profile"}
            </ButtonLink>
            <ButtonLink href="/settings" variant="quiet">
              <Settings2 size={16} aria-hidden="true" />
              Settings
            </ButtonLink>
          </div>
        )}
      </div>
    </header>
  );
}
