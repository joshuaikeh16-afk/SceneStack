import Link from "next/link";
import type { ComponentProps } from "react";

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary" | "quiet";
}) {
  return (
    <Link className={`button button-${variant} ${className}`} {...props} />
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "quiet" }) {
  return (
    <button className={`button button-${variant} ${className}`} {...props} />
  );
}
