import { AltEditorScreen } from "@/components/editor/alt/AltEditorScreen";

/** The dock layout is the default; /panels keeps the original arrangement. */
export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AltEditorScreen sheetId={id} />;
}
