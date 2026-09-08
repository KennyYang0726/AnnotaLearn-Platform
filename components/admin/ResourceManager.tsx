"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DeleteAdminEntityButton from "@/components/admin/DeleteAdminEntityButton";

type Asset = {
  id: string;
  displayName: string;
  originalName: string;
  assigned: boolean;
  learningRecordCount?: number;
  usageCount?: number;
  ownedByCurrentUser?: boolean;
  canDeleteOwnedAsset?: boolean;
  ownerLabel?: string | null;
};

type Props = {
  courseId: string;
  assets: Asset[];
  resourceEndpoint?: string;
  assetDownloadBase?: string;
  assetDeleteBase?: string;
  showOwnership?: boolean;
};

export default function ResourceManager({
  courseId,
  assets,
  resourceEndpoint = "/api/admin/course-resources",
  assetDownloadBase,
  assetDeleteBase,
  showOwnership = false,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [removeTarget, setRemoveTarget] = useState<Asset | null>(null);

  async function add(asset: Asset) {
    setBusy(asset.id); setError("");
    try {
      const response = await fetch(resourceEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, assetId: asset.id, title: asset.displayName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "加入教材失敗");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "加入教材失敗"); }
    finally { setBusy(null); }
  }

  async function remove(asset: Asset) {
    setBusy(asset.id); setError("");
    try {
      const response = await fetch(resourceEndpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, assetId: asset.id, title: asset.displayName, confirmDataLoss: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "移除教材失敗");
      setRemoveTarget(null);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "移除教材失敗"); }
    finally { setBusy(null); }
  }

  return <div className="stack">
    {error && <div className="error">{error}</div>}
    <div className="table-wrap"><table>
      <thead><tr><th>教材</th><th>狀態</th>{showOwnership && <th>資產來源</th>}<th className="action-column">操作</th></tr></thead>
      <tbody>{assets.map((asset) => <tr key={asset.id}>
        <td><strong>{asset.displayName}</strong><div className="subtle asset-filename">{asset.originalName}</div></td>
        <td>{asset.assigned ? <span className="badge">已加入課程</span> : "共用資產庫"}</td>
        {showOwnership && <td>{asset.ownedByCurrentUser ? <span className="badge setting-on">你上傳</span> : <span className="subtle">{asset.ownerLabel || "共用/既有資產"}</span>}</td>}
        <td className="action-column"><div className="resource-manager-actions">
          {assetDownloadBase && <a className="btn btn-outline btn-compact btn-nowrap" href={`${assetDownloadBase}/${asset.id}/download`}>下載</a>}
          <button className={`btn btn-compact btn-nowrap ${asset.assigned ? "btn-danger" : "btn-primary"}`} disabled={busy === asset.id} onClick={() => asset.assigned ? setRemoveTarget(asset) : add(asset)}>{busy === asset.id ? "處理中…" : asset.assigned ? "移除教材" : "加入教材"}</button>
          {assetDeleteBase && asset.ownedByCurrentUser && asset.canDeleteOwnedAsset && <DeleteAdminEntityButton
            endpoint={`${assetDeleteBase}/${asset.id}`}
            title="永久刪除你上傳的資產？"
            subject={asset.displayName}
            detail="此操作會從共用資產庫永久刪除PDF檔案。"
            dangerMessage={(asset.usageCount ?? 0) > 0 ? `此資產目前被${asset.usageCount}門你負責的課程使用，刪除後會從這些課程移除，相關學生學習紀錄也會一併刪除。` : undefined}
            buttonLabel="刪除資產"
          />}
          {assetDeleteBase && asset.ownedByCurrentUser && !asset.canDeleteOwnedAsset && <span className="subtle asset-delete-locked">已被其他課程使用，請由管理員處理</span>}
        </div></td>
      </tr>)}</tbody>
    </table></div>

    {removeTarget && <div className="modal-backdrop" role="presentation" onMouseDown={() => busy !== removeTarget.id && setRemoveTarget(null)}>
      <section className="card modal admin-delete-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="danger-icon" aria-hidden="true">!</div>
        <h2 className="h2">從課程移除教材？</h2>
        <p>即將從此課程移除<strong>{removeTarget.displayName}</strong>。</p>
        {(removeTarget.learningRecordCount ?? 0) > 0 ? <div className="asset-in-use-warning">此教材已有學生學習紀錄。確認移除後，這門課中與此教材相關的繳交、文字筆記、PDF劃記、理解狀態與閱讀停留紀錄會一併刪除，且無法復原。</div> : <div className="delete-impact-note">目前沒有學生學習紀錄，只會解除此課程與教材的關聯，PDF仍保留在共用資產庫。</div>}
        {error && <div className="error">{error}</div>}
        <div className="row delete-actions"><button className="btn btn-outline" type="button" onClick={() => setRemoveTarget(null)} disabled={busy === removeTarget.id}>取消</button><button className="btn btn-danger" type="button" onClick={() => remove(removeTarget)} disabled={busy === removeTarget.id}>{busy === removeTarget.id ? "移除中…" : (removeTarget.learningRecordCount ?? 0) > 0 ? "確認移除並刪除紀錄" : "確認移除"}</button></div>
      </section>
    </div>}
  </div>;
}
