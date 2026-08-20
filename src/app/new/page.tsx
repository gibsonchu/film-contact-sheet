import type { Metadata } from "next";
import { UploadFlow } from "@/components/upload/UploadFlow";

export const metadata: Metadata = { title: "Create a film contact sheet · Film Contact Sheet" };

export default function NewSheetPage() {
  return (
    <main id="main">
      <UploadFlow />
    </main>
  );
}
