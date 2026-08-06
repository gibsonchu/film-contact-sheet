import { EditorScreen } from "@/components/editor/EditorScreen";

export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditorScreen sheetId={id} />;
}
