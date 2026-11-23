import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import Dashboard from "@/components/Dashboard";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <Dashboard user={user} />;
}
