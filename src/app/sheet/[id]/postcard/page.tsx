import { PostcardClient } from "./PostcardClient";

export default async function PostcardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostcardClient sheetId={id} />;
}
