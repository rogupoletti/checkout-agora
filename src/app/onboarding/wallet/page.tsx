import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import WalletOnboarding from "./wallet-onboarding";

export const dynamic = "force-dynamic";

export default async function WalletOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  return <WalletOnboarding email={session.user.email} />;
}
