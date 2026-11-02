import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import InvoiceDashboard from "@/app/ui/invoice-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  return <InvoiceDashboard email={session.user.email} role={session.user.role} />;
}
