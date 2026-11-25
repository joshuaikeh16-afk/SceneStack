export function Avatar({
  name,
  size = "small",
}: {
  name: string;
  size?: "small" | "large";
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      {initials || "S"}
    </span>
  );
}
