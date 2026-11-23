import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import DocumentEditor from "@/components/DocumentEditor";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <DocumentEditor user={user} id={(await params).id} />;
}
