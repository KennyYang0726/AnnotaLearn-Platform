"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CourseResourceOrderControls({ courseId, resourceId, canMoveUp, canMoveDown }: { courseId: string; resourceId: string; canMoveUp: boolean; canMoveDown: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function move(direction: "UP" | "DOWN") {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/course-resources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, resourceId, direction }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "調整教材順序失敗");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "調整教材順序失敗");
    } finally {
      setBusy(false);
    }
  }

  return <div className="resource-order-actions">
    <button type="button" className="btn btn-compact btn-outline" disabled={busy || !canMoveUp} onClick={() => move("UP")}>上移</button>
    <button type="button" className="btn btn-compact btn-outline" disabled={busy || !canMoveDown} onClick={() => move("DOWN")}>下移</button>
  </div>;
}
