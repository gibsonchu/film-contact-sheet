import type { Metadata } from "next";
import { ExplorePage } from "@/components/community/ExplorePage";

export const metadata: Metadata = { title: "Explore · Film Contact Sheet" };

export default function Page() {
  return <ExplorePage />;
}
