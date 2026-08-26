import { requireStudent } from "@/lib/auth/guards";
import StudentHeader from "@/components/student/StudentHeader";
export default async function CoursesLayout({ children }: { children: React.ReactNode }) {
  const student = await requireStudent();
  return <div className="shell"><StudentHeader username={student.username} /><main className="container" style={{ padding: "30px 0" }}>{children}</main></div>;
}
