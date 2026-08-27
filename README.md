# AnnotaLearn

**AnnotaLearn** 是一個以 PDF 教材閱讀、重點劃記、筆記、盲點提問、學生繳交與管理端查閱為核心的精簡教學平台。

這是一個測試／原型專案，不是完整 LMS 或 Moodle 替代品；目前重點放在「教師提供 PDF 教材 → 學生閱讀與註記 → 繳交 → 教師查看」這條流程。

## 主要功能

- ADMIN／STUDENT 兩種角色與伺服器端權限驗證
- ADMIN 建立學期、課程與學生，並將學生分配至課程
- 學生首次登入強制修改預設密碼
- PDF 資產庫，同一份 PDF 可被不同課程引用
- PDF.js 單頁閱讀器與頁碼切換
- 重點筆記與盲點提問
- 紅色螢光筆表示重點，黃色螢光筆表示疑問
- 劃記使用相對座標保存，並嘗試擷取 PDF 文字
- LocalStorage 自動暫存尚未繳交的筆記與劃記內容
- 每頁必須選擇「我懂了」或「我不懂」後才能切頁，並保留最終狀態與完整變更歷程
- 逐次記錄每一頁的停留時間，重複造訪同頁不合併
- 以 Heartbeat、頁面可見性、視窗焦點與閒置判斷降低異常關閉或背景分頁造成的停留時間膨脹
- 依「已實際進入過的不同頁面數 / PDF 總頁數」計算閱讀完成率
- 課程具有起始/結束時間，並以 Asia/Taipei 日界線建立每日學習活動紀錄
- 學生可送出整份教材筆記與劃記
- ADMIN 可查看並篩選筆記、劃記、理解狀態、完成率、逐次停留時間與學習活動天數，並匯出 CSV
- 本機 PDF 儲存模式
- Vercel Private Blob 儲存模式

## 介面展示

<p>以下為實際畫面示意：</p>

<table>
  <tr>
    <td align="center">
      <a href="readme_assets/01.png" target="_blank">
        <img src="readme_assets/01.png" width="400" />
      </a><br/>
      1. 登入頁面
    </td>
    <td align="center">
      <a href="readme_assets/02.png" target="_blank">
        <img src="readme_assets/02.png" width="400" />
      </a><br/>
      2. 教師端新增學期
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="readme_assets/03.png" target="_blank">
        <img src="readme_assets/03.png" width="400" />
      </a><br/>
      3. 教師端新增課程
    </td>
    <td align="center">
      <a href="readme_assets/04.png" target="_blank">
        <img src="readme_assets/04.png" width="400" />
      </a><br/>
      4. 教師端新增學生
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="readme_assets/05.png" target="_blank">
        <img src="readme_assets/05.png" width="400" />
      </a><br/>
      5. 教師端新增資源
    </td>
    <td align="center">
      <a href="readme_assets/06.png" target="_blank">
        <img src="readme_assets/06.png" width="400" />
      </a><br/>
      6. 教師端將資源指定至課程
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="readme_assets/07.png" target="_blank">
        <img src="readme_assets/07.png" width="400" />
      </a><br/>
      7.學生端登入
    </td>
    <td align="center">
      <a href="readme_assets/08.png" target="_blank">
        <img src="readme_assets/08.png" width="400" />
      </a><br/>
      8. 教師端看到學生筆記畫記情形
    </td>
  </tr>
</table>


## 技術架構

- Next.js 16 App Router
- React 19
- TypeScript
- PostgreSQL
- Prisma ORM 7
- PDF.js (`pdfjs-dist`)
- `jose` HttpOnly Session Cookie
- `bcryptjs` 密碼雜湊
- Zod API 輸入驗證
- Vercel Private Blob（正式部署時使用）

## Clone 後快速啟動

### 1. 安裝必要工具

需要：

- Node.js 24 或更新版本
- Git
- Docker Desktop

### 2. Clone 並安裝套件

```bash
git clone <repository-url>
cd AnnotaLearn
npm install
```

### 3. 建立 `.env`

將範例檔複製成 `.env`：

macOS / Linux：

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

至少請修改：

```env
SESSION_SECRET="請換成至少 32 字元以上的隨機字串"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="請換成自己的管理員初始密碼"
```

本機 PostgreSQL 若使用本專案的 `docker-compose.yml`，`DATABASE_URL` 可以直接保留：

```env
DATABASE_URL="postgresql://annotalearn:annotalearn@localhost:5432/annotalearn?schema=public"
```

> `.env` 會包含密碼與 Secret，已被 `.gitignore` 排除，請不要提交到 GitHub。只有 `.env.example` 應該提交。

### 4. 啟動全新的 PostgreSQL

```bash
docker compose up -d
```

這會建立名為 `annotalearn-postgres` 的本機 PostgreSQL container。

### 5. 初始化資料庫結構

```bash
npm run db:deploy
```

這會把 `prisma/migrations` 中的資料庫結構套用到你自己的全新資料庫。

### 6. 建立初始 ADMIN

```bash
npm run db:seed
```

Seed 只會建立／更新 `.env` 中指定的 ADMIN 帳號，不會加入學生、課程、PDF 或繳交紀錄。

### 7. 啟動網站

```bash
npm run dev
```

開啟：

```text
http://localhost:3000
```

使用 `.env` 中的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登入後，就可以自行建立學期、學生、課程與教材。

---

## 更換 Logo / Icon

```text
public/brand-logo.svg
```

要換 Logo，最簡單的方法就是用自己的 SVG 取代 `public/brand-logo.svg`，建議使用正方形 SVG。

瀏覽器分頁 favicon 可在 Next.js 的 `app` 目錄加入 `icon.svg` 即可更換。

---

## 第一次登入後建議操作

1. ADMIN 登入
2. 建立學期
3. 新增學生
4. 建立課程
5. 將學生加入課程
6. 上傳 PDF 教材
7. 將教材加入課程
8. 學生登入並修改初始密碼
9. 學生閱讀、筆記、劃記並繳交
10. ADMIN 到閱讀／繳交紀錄查看結果

學生預設密碼規則為：

```text
學號 + 學號 + !
```

例如學號 `B1042019`：

```text
B1042019B1042019!
```

---

## PDF 劃記資料

劃記以 0～1 的相對座標保存，因此不綁定特定螢幕尺寸。系統也會利用 PDF.js 文字座標嘗試擷取劃記覆蓋到的文字。

若 PDF 是掃描圖片、公式圖片或文字編碼異常，可能只有劃記座標而無法取得文字，目前版本不包含 OCR。

尚未正式繳交的內容會暫存在瀏覽器 LocalStorage，Key 格式為：

```text
annotalearn-draft:<studentId>:<resourceId>
```

LocalStorage 只存在同一台裝置與同一個瀏覽器，不等同於伺服器端草稿同步。

---

## 閱讀研究資料紀錄

AnnotaLearn 將「尚未繳交的學習內容」與「研究用閱讀行為」分開處理：

- **筆記與 PDF 劃記**：仍以 LocalStorage 作為未繳交草稿，按下「繳交教材筆記」後寫入伺服器。
- **閱讀行為資料**：理解狀態、逐頁造訪、停留時間與每日學習活動會在閱讀期間即時寫入伺服器，不依賴最後的繳交按鈕。

### 每頁理解狀態

每一頁有互斥的「我懂了」與「我不懂」選項。未選擇時無法使用上一頁、下一頁或跳頁功能。重新回到已選過的頁面時會保留原狀態，亦可改選另一個狀態。

系統同時保留：

- `PageUnderstandingState`：每一頁目前的最終狀態。
- `PageUnderstandingEvent`：第一次選擇以及後續每一次狀態變更的歷史紀錄。

重複點選同一個既有狀態不會新增一筆無意義的歷史事件。

### 完成率

閱讀完成率定義為：

```text
已實際進入過的不同頁面數 / PDF 總頁數 × 100%
```

例如 5 頁 PDF 曾進入 P.1、P.2、P.3、P.4，即為 80%。P.1 → P.2 → P.1 只算 2 個不同頁面，不會因重複造訪而提高完成率。

### 停留時間與 Heartbeat

`PageVisit` 每次進入頁面都建立獨立紀錄，因此 P.1 → P.2 → P.1 會保留三筆 Visit，不合併 P.1 的兩次停留。

閱讀器每 10 秒送出 Heartbeat，伺服器逐步累加已確認的停留秒數。正常切頁、分頁隱藏、視窗失焦、`pagehide` 與元件卸載時會嘗試結束目前 Visit。若使用者直接關閉分頁、瀏覽器異常終止或網路中斷，未收到最後一個離開事件也不會把停留時間一路延長到數小時或隔天。

另外，閱讀器在以下情況暫停計時：

- 分頁不可見。
- 瀏覽器視窗失去焦點。
- 連續 5 分鐘沒有滑鼠、鍵盤、觸控或滾輪互動。

恢復有效互動後，會在同一頁建立新的 Visit，閒置空檔不計入停留時間。

同一位學生對同一份教材同時間只接受一個持續 Heartbeat 的 Reader Session。若另一個分頁、瀏覽器或裝置仍在有效閱讀，新的 Session 會暫停建立停留紀錄；舊 Session 超過 Heartbeat 租約後會自動視為中斷，避免兩個裝置同時閱讀造成停留秒數重複累加。

管理端與 CSV 的停留時間資料只顯示每次 Visit 的停留時間（`HH:MM:SS` 與秒數），不輸出每一頁的進入/離開 Timestamp。

### 課程期間與每日學習活動

建立課程時必須指定起始時間與結束時間，輸入值以台灣時間（UTC+8）解讀。

`CourseDailyActivity` 會在學生於有效課程期間進入課程或產生有效閱讀行為時，即時建立「該課程 / 該學生 / 該日」唯一的一筆每日紀錄，因此不是課程結束後才從 Log 回推。

每日日期一律依 `Asia/Taipei` 判定。若學生於 23:00 持續有效閱讀至隔日 00:30，午夜前後兩個日曆日都會各自留下活動日；若午夜前已切到其他分頁或進入閒置狀態，隔日不會因背景程式仍存在而自動算一天。

資料庫 Timestamp 可維持 UTC 儲存，但活動日的歸屬不依主機、Docker 或 PostgreSQL 的系統時區判斷。

### 管理端研究資料

「閱讀/繳交紀錄」可直接檢視尚未按下繳交的學生，並提供：

- 閱讀完成率與已閱讀頁數。
- 最終「我不懂」頁面。
- 最終理解狀態與完整變更歷程。
- 每一次 PageVisit 的停留時間。
- 課程期間內的學習活動天數。
- 日期、學生、頁碼、紀錄類型、理解狀態、完成率等篩選。
- CSV 匯出。

學生詳細頁以單一下拉選單切換「文字筆記」、「PDF 劃記」與「停留時間紀錄」，避免同一畫面同時堆疊大量紀錄。

---

## 部署到 Vercel

建議流程：

```text
本機開發 → GitHub → Vercel
```

1. 將專案 Push 到 GitHub（確認 `.env` 沒有被加入）
2. 在 Vercel Import Git Repository
3. 設定 Production 的環境變數
4. Production PostgreSQL 執行 migrations
5. 建立 Production ADMIN
6. 正式環境若要保存 PDF，將 Storage Driver 改為 Vercel Private Blob

Vercel 常用環境變數：

```text
DATABASE_URL=<正式 PostgreSQL 連線字串>
SESSION_SECRET=<Production 專用長亂數>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<Production 初始管理員密碼>
STORAGE_DRIVER=blob
NEXT_PUBLIC_STORAGE_DRIVER=blob
BLOB_READ_WRITE_TOKEN=<由 Vercel Blob 提供>
```

正式資料庫套用既有 migrations：

```bash
npm run db:deploy
```

建立正式環境 ADMIN：

```bash
npm run db:seed
```

> Production 不要使用 `prisma migrate dev` 來部署既有 migrations。
