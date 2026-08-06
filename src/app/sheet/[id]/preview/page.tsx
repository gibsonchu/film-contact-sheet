import { PreviewClient } from "./PreviewClient";

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PreviewClient sheetId={id} />;
}
