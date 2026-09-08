import { requireTa } from "@/lib/auth/guards";
import TaShell from "@/components/ta/TaShell";

export default async function TaLayout({ children }: { children: React.ReactNode }) {
  const ta = await requireTa();
  return <TaShell username={ta.username}>{children}</TaShell>;
}
