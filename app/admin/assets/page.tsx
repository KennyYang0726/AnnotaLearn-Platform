import { prisma } from "@/lib/db";
import AssetUploadForm from "@/components/admin/AssetUploadForm";
import DeleteAdminEntityButton from "@/components/admin/DeleteAdminEntityButton";

function bytes(size: number) {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default async function AssetsPage() {
  const assets = await prisma.asset.findMany({
    include: { _count: { select: { resources: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="stack">
      <div className="page-head"><h1 className="h1">PDF資產庫</h1></div>
      <div className="grid-2">
        <section className="card panel">
          <h2 className="h2">上傳PDF</h2>
          <AssetUploadForm />
        </section>
        <section className="card panel">
          <h2 className="h2">資產列表</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>名稱</th><th>頁數</th><th>大小</th><th>使用課程</th><th className="action-column">操作</th></tr></thead>
              <tbody>
                {assets.map((asset) => {
                  const usageCount = asset._count.resources;
                  return (
                    <tr key={asset.id}>
                      <td><strong>{asset.displayName}</strong><div className="subtle">{asset.originalName}</div></td>
                      <td>{asset.pageCount ?? "—"}</td>
                      <td>{bytes(asset.fileSize)}</td>
                      <td>{usageCount}</td>
                      <td className="action-column">
                        <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
                          <a className="btn btn-outline" href={`/api/admin/assets/${asset.id}/download`}>下載</a>
                          <DeleteAdminEntityButton
                          endpoint={`/api/admin/assets/${asset.id}`}
                          title="刪除資產？"
                          subject={asset.displayName}
                          detail="刪除後，實際儲存的PDF檔案也會一併清除。"
                          impact={usageCount === 0 ? "此資產目前未被任何課程使用。" : undefined}
                          dangerMessage={usageCount > 0 ? `此資源目前正在被${usageCount}個課程使用。刪除後會同時從這些課程移除教材，且相關學生的繳交、筆記與劃記紀錄也會一併刪除。` : undefined}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
