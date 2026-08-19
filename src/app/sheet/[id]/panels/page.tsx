import { EditorScreen } from "@/components/editor/EditorScreen";

/** The original panelled arrangement, kept alongside the default dock layout. */
export default async function PanelSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditorScreen sheetId={id} />;
}
