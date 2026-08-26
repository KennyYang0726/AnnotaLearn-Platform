import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function SubmissionDetailPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  const s = await prisma.readingSubmission.findUnique({ where: { id: submissionId }, include: { user: true, resource: { include: { course: { include: { semester: true } }, asset: true } }, notes: { orderBy: [{ page: "asc" }, { createdAt: "asc" }] }, highlights: { orderBy: [{ page: "asc" }, { createdAt: "asc" }] } } });
  if (!s) notFound();
  return <div className="stack"><div className="page-head"><Link href={`/admin/submissions/course/${s.resource.course.id}/resource/${s.resource.id}`} className="subtle">←返回學生紀錄</Link><h1 className="h1" style={{ marginTop: 12 }}>{s.user.username} / {s.resource.title}</h1><div className="subtle">{s.resource.course.semester.code} / {s.resource.course.name} / {new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "medium" }).format(s.submittedAt)}</div></div>
  <div className="grid-2"><section className="card panel"><h2 className="h2">文字筆記</h2>{s.notes.length === 0 ? <div className="subtle">沒有文字筆記。</div> : s.notes.map((n) => <article className="note-card" key={n.id}><div className="note-meta"><span>{n.type === "KEY_POINT" ? "重點" : "盲點提問"}</span><span>P.{n.page}</span></div><div>{n.content}</div></article>)}</section>
  <section className="card panel"><h2 className="h2">PDF劃記</h2>{s.highlights.length === 0 ? <div className="subtle">沒有PDF劃記。</div> : s.highlights.map((h) => { const geometry = h.geometry as { points?: [number,number][] }; return <article className="note-card" key={h.id}><div className="note-meta"><span>{h.color === "RED" ? "紅色 / 重點" : "黃色 / 疑問"}</span><span>P.{h.page}</span></div><div><strong>對應文字：</strong>{h.extractedText || "無可擷取文字"}</div><div className="subtle">座標點數：{geometry.points?.length || 0}</div></article>; })}</section></div></div>;
}
