import { cx } from "@/components/ui/primitives";

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** No default-avatar asset exists in this app — a generated initials circle
 *  stands in whenever avatarUrl is unset, same as most social apps do. */
export function Avatar({
  displayName,
  avatarUrl,
  size = "md",
}: {
  displayName: string | null;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "lg" ? "h-16 w-16 text-[18px]" : size === "sm" ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-[13px]";
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={cx("rounded-full object-cover", dims)} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cx("grid shrink-0 place-items-center rounded-full bg-graphite text-warm", dims)}
    >
      {initials(displayName)}
    </span>
  );
}
