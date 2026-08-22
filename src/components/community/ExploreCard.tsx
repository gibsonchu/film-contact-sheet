import Link from "next/link";
import { IconHeart } from "@/components/icons";
import type { PublicSheetCard } from "@/lib/explore";

export function ExploreCard({ sheet }: { sheet: PublicSheetCard }) {
  return (
    <Link href={`/explore/${sheet.id}`} className="block">
      <div className="flex aspect-[4/3] items-end justify-center overflow-hidden bg-charcoal">
        {sheet.coverThumb ? (
          <img src={sheet.coverThumb} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="label m-auto">Empty</span>
        )}
      </div>
      <div className="mt-1.5 leading-[1.35]">
        <p className="truncate text-[11px] text-warm">{sheet.title ?? "Untitled"}</p>
        <p className="label truncate">
          {sheet.photographer ? sheet.photographer : " "}
        </p>
        <p className="label flex items-center gap-1 truncate opacity-70">
          <IconHeart className="h-2.5 w-2.5" />
          {sheet.likeCount}
        </p>
      </div>
    </Link>
  );
}
