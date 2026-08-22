import type { Metadata } from "next";
import { ProjectLibrary } from "@/components/library/ProjectLibrary";

export const metadata: Metadata = { title: "Contact sheets · Film Contact Sheet" };

export default function SheetsPage() {
  return (
    <main id="main">
      <ProjectLibrary />
    </main>
  );
}
