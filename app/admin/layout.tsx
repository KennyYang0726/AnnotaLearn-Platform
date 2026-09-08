import { requireAdmin } from "@/lib/auth/guards";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return <AdminShell username={admin.username}>{children}</AdminShell>;
}
