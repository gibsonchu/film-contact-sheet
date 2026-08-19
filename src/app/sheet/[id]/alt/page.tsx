import { AltEditorScreen } from "@/components/editor/alt/AltEditorScreen";

export default async function AltSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AltEditorScreen sheetId={id} />;
}
