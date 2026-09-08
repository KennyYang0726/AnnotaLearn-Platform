import SystemResetPanel from "@/components/admin/SystemResetPanel";

export default function SettingsPage() {
  return <div className="stack">
    <div className="page-head"><h1 className="h1">系統設定</h1></div>
    <div className="settings-section">
      <section className="card panel danger-zone">
        <div className="danger-zone-head">
          <div>
            <h2 className="h2 danger-zone-title">一鍵清除全部</h2>
            <p>永久移除教學期間建立的資料與PDF教材檔案。</p>
          </div>
          <SystemResetPanel />
        </div>
        <ul className="reset-scope">
          <li>學生帳號與課程分配</li>
          <li>課程、學期與教材設定</li>
          <li>閱讀繳交、文字筆記與螢光筆劃記</li>
          <li>PDF資產資料與已上傳的PDF檔案</li>
        </ul>
        <p className="subtle">管理端帳號與部署環境設定不會被刪除。</p>
      </section>
    </div>
  </div>;
}
