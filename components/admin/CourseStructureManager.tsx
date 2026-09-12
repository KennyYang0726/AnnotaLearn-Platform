"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CourseResourceOrderControls from "@/components/admin/CourseResourceOrderControls";

type Section = { id: string; title: string; description: string | null };
type Resource = {
  id: string;
  title: string;
  originalName: string;
  sectionId: string | null;
  readingTaskEnabled: boolean;
  availableFrom: string;
  dueAt: string;
  submittedCount: number;
};

type Props = {
  courseId: string;
  sections: Section[];
  resources: Resource[];
  sectionEndpoint?: string;
  resourceEndpoint?: string;
};

function ResourceSettings({ courseId, resource, sections, resourceEndpoint, groupResources }: { courseId: string; resource: Resource; sections: Section[]; resourceEndpoint: string; groupResources: Resource[] }) {
  const router = useRouter();
  const [sectionId, setSectionId] = useState(resource.sectionId ?? "");
  const [taskEnabled, setTaskEnabled] = useState(resource.readingTaskEnabled);
  const [availableFrom, setAvailableFrom] = useState(resource.availableFrom);
  const [dueAt, setDueAt] = useState(resource.dueAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const currentIndex = groupResources.findIndex((item) => item.id === resource.id);

  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch(resourceEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, resourceId: resource.id, sectionId: sectionId || null, readingTaskEnabled: taskEnabled, availableFrom: taskEnabled ? availableFrom : "", dueAt: taskEnabled ? dueAt : "" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "教材設定儲存失敗");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "教材設定儲存失敗"); }
    finally { setBusy(false); }
  }

  return <article className="course-structure-resource">
    <div className="course-structure-resource-head">
      <div className="course-resource-main">
        <div className="row course-resource-badges"><span className="badge">PDF教材</span>{resource.readingTaskEnabled && <span className="badge reading-task-badge">閱讀任務</span>}<span className="badge">{resource.submittedCount}份已繳交</span></div>
        <strong>{resource.title}</strong>
        <div className="subtle asset-filename">{resource.originalName}</div>
      </div>
      <CourseResourceOrderControls courseId={courseId} resourceId={resource.id} canMoveUp={currentIndex > 0} canMoveDown={currentIndex >= 0 && currentIndex < groupResources.length - 1} endpoint={resourceEndpoint} />
    </div>

    <div className="course-resource-config-grid">
      <label>課程單元
        <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">未分組</option>
          {sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
        </select>
      </label>
      <label className="reading-task-toggle"><span>閱讀任務</span><span className="subtle">啟用後可另外設定開放與截止時間。</span><input type="checkbox" checked={taskEnabled} onChange={(e) => setTaskEnabled(e.target.checked)} /></label>
    </div>

    {taskEnabled && <div className="reading-task-time-grid">
      <label>開放時間 <span className="subtle">選填；未設定則立即可閱讀</span><input type="datetime-local" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} /></label>
      <label>截止時間 <span className="subtle">選填；逾期仍可閱讀與補交</span><input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></label>
    </div>}
    {error && <div className="error">{error}</div>}
    <div className="course-resource-save-row"><button type="button" className="btn btn-primary btn-compact" disabled={busy} onClick={save}>{busy ? "儲存中…" : "儲存教材設定"}</button></div>
  </article>;
}

export default function CourseStructureManager({ courseId, sections, resources, sectionEndpoint = "/api/admin/course-sections", resourceEndpoint = "/api/admin/course-resources" }: Props) {
  const router = useRouter();
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const grouped = useMemo(() => {
    const result = new Map<string, Resource[]>();
    for (const resource of resources) {
      const key = resource.sectionId ?? "__unassigned__";
      const list = result.get(key) ?? [];
      list.push(resource); result.set(key, list);
    }
    return result;
  }, [resources]);

  async function createSection() {
    if (!newTitle.trim()) return;
    setBusy("new"); setError("");
    try {
      const response = await fetch(sectionEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, title: newTitle, description: newDescription }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "新增單元失敗");
      setNewTitle(""); setNewDescription(""); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "新增單元失敗"); }
    finally { setBusy(null); }
  }

  async function updateSection(section: Section, patch: { title?: string; description?: string; direction?: "UP" | "DOWN" }) {
    setBusy(section.id); setError("");
    try {
      const response = await fetch(sectionEndpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, sectionId: section.id, ...patch }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "更新單元失敗");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "更新單元失敗"); }
    finally { setBusy(null); }
  }

  async function removeSection(section: Section) {
    if (!window.confirm(`刪除「${section.title}」？其中教材不會被刪除，會移到「未分組」。`)) return;
    setBusy(section.id); setError("");
    try {
      const response = await fetch(sectionEndpoint, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, sectionId: section.id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "刪除單元失敗");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "刪除單元失敗"); }
    finally { setBusy(null); }
  }

  return <div className="stack course-structure-manager">
    <section className="course-section-editor">
      <div className="between"><div><h3 className="course-structure-title">課程單元／週次</h3><div className="subtle">可依週次或主題建立單元；不建立也能維持原本的教材清單。</div></div></div>
      <div className="course-section-create-grid"><label>單元名稱<input value={newTitle} maxLength={120} placeholder="例如：第1週、單元一 靜力平衡" onChange={(e) => setNewTitle(e.target.value)} /></label><label>說明（選填）<input value={newDescription} maxLength={500} placeholder="簡短說明本單元內容" onChange={(e) => setNewDescription(e.target.value)} /></label><button type="button" className="btn btn-primary" disabled={busy === "new" || !newTitle.trim()} onClick={createSection}>{busy === "new" ? "新增中…" : "新增單元"}</button></div>
      {sections.length > 0 && <div className="course-section-list">{sections.map((section, index) => <SectionRow key={section.id} section={section} index={index} total={sections.length} busy={busy === section.id} onSave={updateSection} onRemove={removeSection} />)}</div>}
    </section>

    {error && <div className="error">{error}</div>}

    <section className="course-resource-structure">
      <div><h3 className="course-structure-title">教材安排與閱讀任務</h3><div className="subtle">閱讀任務預設關閉。開放時間會限制學生進入；截止後不鎖定教材，仍允許補交。</div></div>
      {resources.length === 0 ? <div className="subtle">尚未加入教材。</div> : <>
        {sections.map((section) => {
          const list = grouped.get(section.id) ?? [];
          if (list.length === 0) return null;
          return <div className="course-structure-group" key={section.id}><div className="course-structure-group-head"><strong>{section.title}</strong>{section.description && <span className="subtle">{section.description}</span>}</div>{list.map((resource) => <ResourceSettings key={resource.id} courseId={courseId} resource={resource} sections={sections} resourceEndpoint={resourceEndpoint} groupResources={list} />)}</div>;
        })}
        {(grouped.get("__unassigned__") ?? []).length > 0 && <div className="course-structure-group"><div className="course-structure-group-head"><strong>未分組</strong><span className="subtle">尚未指定課程單元的教材</span></div>{(grouped.get("__unassigned__") ?? []).map((resource) => <ResourceSettings key={resource.id} courseId={courseId} resource={resource} sections={sections} resourceEndpoint={resourceEndpoint} groupResources={grouped.get("__unassigned__") ?? []} />)}</div>}
      </>}
    </section>
  </div>;
}

function SectionRow({ section, index, total, busy, onSave, onRemove }: { section: Section; index: number; total: number; busy: boolean; onSave: (section: Section, patch: { title?: string; description?: string; direction?: "UP" | "DOWN" }) => Promise<void>; onRemove: (section: Section) => Promise<void> }) {
  const [title, setTitle] = useState(section.title);
  const [description, setDescription] = useState(section.description ?? "");
  return <div className="course-section-row"><div className="course-section-number">{String(index + 1).padStart(2, "0")}</div><div className="course-section-fields"><input aria-label="單元名稱" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /><input aria-label="單元說明" value={description} maxLength={500} placeholder="單元說明（選填）" onChange={(e) => setDescription(e.target.value)} /></div><div className="course-section-actions"><button type="button" className="btn btn-outline btn-compact" disabled={busy || index === 0} onClick={() => onSave(section, { direction: "UP" })}>上移</button><button type="button" className="btn btn-outline btn-compact" disabled={busy || index === total - 1} onClick={() => onSave(section, { direction: "DOWN" })}>下移</button><button type="button" className="btn btn-primary btn-compact" disabled={busy || !title.trim()} onClick={() => onSave(section, { title, description })}>儲存</button><button type="button" className="btn btn-danger btn-compact" disabled={busy} onClick={() => onRemove(section)}>刪除</button></div></div>;
}
