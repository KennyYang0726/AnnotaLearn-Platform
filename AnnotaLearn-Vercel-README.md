# AnnotaLearn — Vercel 部署說明

這份文件說明如何將 **AnnotaLearn** 從 GitHub 部署到 Vercel。

目前專案主要使用：

- Next.js
- Prisma
- PostgreSQL
- Vercel Blob（Private）
- GitHub
- Vercel

> 本機開發使用 Docker PostgreSQL 與 `.env`；正式部署到 Vercel 後，會改用雲端 PostgreSQL 與 Vercel Environment Variables。

---

# 一、部署後的架構

本機開發：

```text
Next.js
  │
  ├─ 本機 .env
  │
  ├─ Docker PostgreSQL
  │
  └─ storage/uploads
```

Vercel 正式環境：

```text
GitHub
  │
  ▼
Vercel
  │
  ├─ Next.js
  │
  ├─ Environment Variables
  │
  ├─ 雲端 PostgreSQL
  │
  └─ Vercel Private Blob
```

Vercel **不會使用你電腦上的 Docker PostgreSQL**，也不能連線到：

```text
localhost:5432
```

因此正式部署前，需要另外準備一個可以從網路連線的 PostgreSQL。

---

# 二、部署前確認

請先確認：

- 專案已 Push 到 GitHub
- GitHub 裡沒有 `.env`
- GitHub 裡有 `.env.example`
- GitHub 裡有 `prisma/migrations`
- 本機 `npm run build` 可以正常完成
- Logo / Icon 已經換成需要的版本

---

# 三、建立正式 PostgreSQL

可以使用支援 PostgreSQL 的雲端服務，例如：

- Neon
- Prisma Postgres
- Supabase
- 其他 PostgreSQL Provider

也可以從 Vercel Marketplace 建立。

建立資料庫後，服務商通常會提供一條 PostgreSQL Connection String，例如：

```env
DATABASE_URL="postgresql://username:password@database-host.example.com/database?sslmode=require"
```

這就是正式環境要使用的：

```text
DATABASE_URL
```

## 不要使用本機 DATABASE_URL

本機可能是：

```env
DATABASE_URL="postgresql://annotalearn:annotalearn@localhost:5432/annotalearn?schema=public"
```

這只適用於本機 Docker。

Vercel 無法使用你的：

```text
localhost
```

---

# 四、將 GitHub Repository 匯入 Vercel

登入 Vercel 後：

```text
Vercel Dashboard
→ Add New
→ Project
→ Import Git Repository
→ 選擇 AnnotaLearn Repository
```

正常情況下 Vercel 會自動辨識：

```text
Framework Preset
Next.js
```

如果專案就在 Repository 根目錄：

```text
Root Directory
./
```

Install Command 可以保持預設。

Output Directory 也不需要另外設定。

---

# 五、設定 Build Command

AnnotaLearn 目前的 `package.json` 已經有：

```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "db:deploy": "prisma migrate deploy && prisma generate"
  }
}
```

因此在 Vercel 的 Build Command 建議設定成：

```bash
npm run db:deploy && npm run build
```

它等同於：

```text
prisma migrate deploy
        ↓
prisma generate
        ↓
next build
```

這樣每次正式部署時，Vercel 都會先確認 Production Database 是否有尚未套用的 migration，再 Build Next.js。

---

# 六、設定 Production Environment Variables

到：

```text
Vercel Project
→ Settings
→ Environment Variables
```

目前第一次部署，建議先只設定在：

```text
Production
```

需要以下變數。

## DATABASE_URL

```env
DATABASE_URL="你的正式 PostgreSQL Connection String"
```

不要填 localhost。

---

## SESSION_SECRET

正式環境請產生一組新的 Secret。

可以在 PowerShell 執行：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

將產生的結果放進：

```env
SESSION_SECRET="產生出來的亂數"
```

不要與本機使用同一組 Secret。

---

## ADMIN_USERNAME

例如：

```env
ADMIN_USERNAME="admin"
```

也可以改成其他帳號名稱。

---

## ADMIN_PASSWORD

設定正式站 ADMIN 密碼：

```env
ADMIN_PASSWORD="你自己的安全密碼"
```

請不要使用 `.env.example` 中的示範文字作為正式密碼。

---

## STORAGE_DRIVER

Vercel 上不要使用本機檔案儲存。

設定：

```env
STORAGE_DRIVER="blob"
```

---

## NEXT_PUBLIC_STORAGE_DRIVER

設定：

```env
NEXT_PUBLIC_STORAGE_DRIVER="blob"
```

---

## 此時 Production ENV 應該至少有

```text
DATABASE_URL
SESSION_SECRET
ADMIN_USERNAME
ADMIN_PASSWORD
STORAGE_DRIVER
NEXT_PUBLIC_STORAGE_DRIVER
```

目前先不用設定：

```text
LOCAL_STORAGE_DIR
```

因為：

```env
LOCAL_STORAGE_DIR="storage/uploads"
```

是本機開發模式使用的。

---

# 七、第一次 Deploy

Environment Variables 設定完成後：

```text
Deploy
```

Vercel Build Log 中應該會依序執行：

```text
prisma migrate deploy
prisma generate
next build
```

第一次對全新的 Production Database 執行時，Prisma 會依照：

```text
prisma/migrations/
```

建立 AnnotaLearn 所需的資料表。

成功後，你會得到類似：

```text
https://annotalearn-xxxxx.vercel.app
```

---

# 八、建立 Vercel Private Blob

AnnotaLearn 的 PDF 正式環境建議使用：

```text
Vercel Private Blob
```

不要把 Vercel 的本機檔案系統當成永久 PDF 儲存空間。

到：

```text
Vercel Project
→ Storage
→ Create Database
→ Blob
```

建立 Blob Store 時選：

```text
Private
```

如果 Vercel 詢問要將 Blob Token 加到哪些 Environment：

```text
Production
```

目前先選 Production 即可。

建立在目前這個 Vercel Project 裡時，Vercel 會自動加入：

```text
BLOB_READ_WRITE_TOKEN
```

因此最後 Environment Variables 會多出：

```text
BLOB_READ_WRITE_TOKEN
```

它是 Secret，不要放到 GitHub。

> Blob Store 的 Public / Private 模式建立後不應隨意選錯。AnnotaLearn 儲存的是教材 PDF，應使用 Private Blob。

---

# 九、Blob 建立後重新 Deploy

Environment Variable 是套用在 Deployment 上。

所以新增 Blob Store / `BLOB_READ_WRITE_TOKEN` 後：

```text
Vercel Project
→ Deployments
→ 找最新一次 Deployment
→ Redeploy
```

或者之後再 Push 一次新的 commit，也會建立新的 Deployment。

---

# 十、第一次初始化 ADMIN

`prisma migrate deploy` 只會建立 / 更新資料庫的「結構」。

它不會建立你的 ADMIN 帳號。

AnnotaLearn 的 ADMIN 是由：

```bash
npm run db:seed
```

建立。

第一次 Production 部署完成後，可以使用 Vercel CLI 執行一次 Seed。

## 1. 安裝 Vercel CLI

```powershell
npm install -g vercel
```

## 2. 登入

```powershell
vercel login
```

## 3. 在 AnnotaLearn 本機專案目錄執行

```powershell
vercel link
```

選擇剛才建立的 AnnotaLearn Vercel Project。

這會在本機建立：

```text
.vercel/
```

`.vercel` 已經被 `.gitignore` 排除，不需要 Push。

## 4. 使用 Production ENV 執行 Seed

```powershell
vercel env run -e production -- npm run db:seed
```

這個指令會：

```text
讀取 Vercel Production Environment Variables
                ↓
使用 Production DATABASE_URL
                ↓
執行 npm run db:seed
                ↓
建立 Production ADMIN
```

不需要把 Production `DATABASE_URL` 複製進你本機的 `.env`。

Seed 成功後，Production Database 應該只有初始化所需的 ADMIN，而不會帶入你的本機學生、課程、PDF 或筆記資料。

---

# 十一、登入正式網站

部署及 Seed 完成後，開啟：

```text
https://你的網域/admin
```

例如：

```text
https://annotalearn-xxxxx.vercel.app/admin
```

使用 Vercel Environment Variables 裡設定的：

```text
ADMIN_USERNAME
ADMIN_PASSWORD
```

登入。

---

# 十二、正式站功能測試

建議至少測試以下項目：

1. ADMIN 可以登入
2. 可以建立學期
3. 可以建立課程
4. 可以建立學生
5. 可以上傳 PDF
6. PDF 可以正常從 Private Blob 讀取
7. 學生可以登入
8. 學生可以閱讀 PDF
9. 筆記 / 劃記功能正常
10. 重新整理頁面後資料仍然存在

如果 PDF 上傳失敗，第一個要確認的是：

```text
BLOB_READ_WRITE_TOKEN
```

如果資料庫操作失敗，第一個要確認的是：

```text
DATABASE_URL
```

---

# 十三、之後如何更新網站

之後正常開發流程可以保持：

```bash
git add .
git commit -m "update"
git push
```

如果 Push 到 Production Branch（通常是 `main`）：

```text
GitHub main
    ↓
Vercel 自動部署
    ↓
prisma migrate deploy
    ↓
next build
    ↓
更新 Production
```

如果這次沒有新增 migration：

```text
prisma migrate deploy
```

會發現沒有新的 migration，因此不會重新建立資料庫。

---

# 十四、如果修改 Prisma Schema

假設你本機修改：

```text
prisma/schema.prisma
```

例如新增：

```text
Course.description
```

開發環境應該執行：

```bash
npm run db:migrate -- --name add_course_description
```

或：

```bash
npx prisma migrate dev --name add_course_description
```

這會建立一個新的：

```text
prisma/migrations/xxxxxxxx_add_course_description/
```

確認本機正常後：

```bash
git add .
git commit -m "add course description"
git push
```

Vercel Production Build 時：

```text
prisma migrate deploy
```

就會把這個新 migration 套用到 Production Database。

---

# 十五、Environment Variables 修改後記得 Redeploy

如果你修改：

```text
DATABASE_URL
SESSION_SECRET
ADMIN_PASSWORD
STORAGE_DRIVER
BLOB_READ_WRITE_TOKEN
```

請重新 Deploy。

已經存在的 Deployment 不會因為你修改 Environment Variables 而自動重新建置。

---

# 十六、常見問題

## P1000 Authentication failed

例如：

```text
Error: P1000
Authentication failed against database server
```

檢查：

```text
DATABASE_URL
```

帳號、密碼、Host、Database Name 是否正確。

---

## Vercel 顯示 localhost

如果 Production Log 出現：

```text
localhost:5432
```

表示 Production `DATABASE_URL` 設錯。

Vercel 不應該使用本機：

```env
postgresql://annotalearn:annotalearn@localhost:5432/annotalearn
```

---

## PDF 無法上傳

確認：

```text
STORAGE_DRIVER=blob
NEXT_PUBLIC_STORAGE_DRIVER=blob
BLOB_READ_WRITE_TOKEN
```

並確認 Blob Store 是：

```text
Private
```

---

## 修改 Environment Variable 後網站還是舊設定

請：

```text
Redeploy
```

---

## Build 出現 prisma command not found

確認 Vercel 安裝階段有安裝 Prisma CLI。

目前專案的 `prisma` 在 `devDependencies`。

如果部署環境出現 Prisma CLI 被省略的情況，可以將：

```json
"prisma": "^7.7.0"
```

移到：

```json
"dependencies"
```

重新：

```bash
npm install
git add package.json package-lock.json
git commit -m "move prisma cli to production dependencies"
git push
```

再重新部署。

---

# 補充說明

下面是前面提到的兩個比較容易混淆的概念。

---

# 補充一：什麼是 Preview Deployment？

可以先把 Vercel 想成有兩種網站。

## Production

Production 就是：

> 真正給使用者使用的正式網站。

例如你的 GitHub：

```text
main
```

Push 後：

```text
main
  ↓
Vercel
  ↓
Production
  ↓
https://annotalearn.vercel.app
```

這個就是正式站。

---

## Preview

Preview 可以理解成：

> 還沒放到正式站以前，用來看「這次修改會變成什麼樣子」的臨時測試網站。

例如你建立：

```text
main
```

之外的 Branch：

```text
feature-new-reader
```

GitHub 會變成：

```text
main
│
└─ feature-new-reader
```

如果 GitHub Repository 已連接 Vercel，Vercel 可以替：

```text
feature-new-reader
```

建立自己的網址：

```text
https://annotalearn-git-feature-new-reader-xxxxx.vercel.app
```

這就是 Preview Deployment。

正式站仍然是：

```text
main
↓
Production
```

而測試 Branch 則是：

```text
feature-new-reader
↓
Preview
```

兩者是不同的 Deployment。

---

## Preview 有什麼用？

例如你想改整個 PDF Reader，但不確定會不會壞掉。

可以：

```bash
git checkout -b new-pdf-reader
```

修改完成後 Push：

```bash
git push -u origin new-pdf-reader
```

Vercel 可以替這個 Branch 建一個 Preview URL。

你可以先測：

```text
新 PDF Reader
登入
資料庫
UI
手機版
```

都沒問題後，再把它 Merge 回：

```text
main
```

才真正更新 Production。

---

# 那我現在需要 Preview 嗎？

以目前 AnnotaLearn 是測試專案，而且主要由你自己開發的情況：

> **不用。**

你現在完全可以只使用：

```text
main
↓
Production
```

也就是：

```bash
修改
git add .
git commit
git push
```

然後直接讓 Vercel 更新正式站。

Preview 是之後專案變大、有其他開發者，或你開始使用 Branch / Pull Request 時才比較有價值。

因此第一次部署時，Environment Variables 可以先只設定：

```text
Production
```

Preview 可以先不設定。

---

# 為什麼 Preview Database 要特別注意？

假設 Production 使用：

```text
DATABASE_URL
↓
正式 DB
```

同時 Preview 也使用完全相同的：

```text
DATABASE_URL
↓
正式 DB
```

然後你在測試 Branch 新增了一個 migration：

```text
feature-new-reader
↓
Vercel Preview Build
↓
prisma migrate deploy
↓
正式 DB
```

那 Preview 還沒 Merge 到 `main`，就可能先修改正式 Database Schema。

這不是理想狀況。

所以真正開始使用 Preview 時，最好變成：

```text
Production
DATABASE_URL → Production DB
```

```text
Preview
DATABASE_URL → Preview / Test DB
```

兩個資料庫分開。

---

## 目前最簡單的做法

你現在先：

```text
只使用 main
只設定 Production ENV
```

即可。

等以後真的開始使用 Git Branch / Pull Request，再建立 Preview Database。

不用為了 Preview 增加第一次部署的複雜度。

---

# 補充二：`prisma migrate deploy` 到底是什麼？

這個指令第一次看到很容易以為：

> 是不是把我本機 DB 上傳到 Vercel？

**不是。**

---

# Migration 可以想成「資料庫施工圖」

你的專案裡：

```text
prisma/migrations/
```

可能有：

```text
20260825085546_init/
20260825171000_add_student_roster_fields/
```

裡面記錄的是：

```text
建立 User table
建立 Course table
建立 Asset table
User 增加某欄位
...
```

它不是：

```text
學生 A
學生 B
課程資料
PDF
筆記
密碼
```

所以 migration 不等於你的 Database Data。

---

# `prisma migrate deploy` 做什麼？

假設 Production Database 現在什麼都沒有。

執行：

```bash
prisma migrate deploy
```

Prisma 會看：

```text
prisma/migrations/
```

然後依序把尚未執行的 migration 套到目前：

```text
DATABASE_URL
```

所指向的 Database。

第一次可能是：

```text
空 PostgreSQL
    ↓
migration 1：建立 User
    ↓
migration 2：建立 Course
    ↓
migration 3：新增 Student 欄位
    ↓
完成
```

結果是：

```text
有資料表
但沒有你的本機資料
```

---

# 第二次部署會怎樣？

假設這些 migration 已經套用過：

```text
migration A ✅
migration B ✅
migration C ✅
```

再次執行：

```bash
prisma migrate deploy
```

Prisma 會知道：

```text
A 已經做過
B 已經做過
C 已經做過
```

所以：

```text
沒有 Pending Migration
→ 不需要做事
```

它不會每次重新建立全部 Database。

---

# 如果之後新增 migration？

例如：

```text
migration A ✅
migration B ✅
migration C ✅
migration D ← 新的
```

Production Deploy 時：

```bash
prisma migrate deploy
```

只會套：

```text
migration D
```

---

# Prisma 怎麼知道哪些做過？

Prisma Database 裡會維護 migration history。

可以簡單理解成資料庫裡有一份紀錄：

```text
A 已完成
B 已完成
C 已完成
```

因此它可以判斷哪些 migration 還沒有執行。

實際上 Prisma 會使用 `_prisma_migrations` table 追蹤 migration 狀態。

---

# `migrate dev` 和 `migrate deploy` 有什麼不同？

## 本機開發

你修改：

```text
prisma/schema.prisma
```

需要「產生新的 migration」。

使用：

```bash
prisma migrate dev
```

可以理解成：

```text
我改 Schema
↓
幫我建立新的 migration
↓
順便套到本機 DB
```

所以：

```text
migrate dev
= 開發者建立 migration
```

---

## Production

Production 不應該臨時幫你「想一個 migration」。

它只應該執行 Git 裡已經確認過的 migration。

因此使用：

```bash
prisma migrate deploy
```

可以理解成：

```text
Git 裡有哪些已經準備好的 migration？
↓
找出 Production 還沒做的
↓
把它們執行掉
```

所以：

```text
migrate deploy
= 套用已經存在的 migration
```

---

# 簡單比較

| 指令 | 用途 | 建議環境 |
| --- | --- | --- |
| `prisma migrate dev` | 建立新的 migration 並套用 | 本機開發 |
| `prisma migrate deploy` | 套用 Git 中尚未執行的 migration | Production / Preview |
| `prisma migrate reset` | 清空 DB 並重新套用 migrations | 本機測試 |
| `prisma db push` | 直接將 schema 推到 DB，不建立正式 migration history | Prototype / 特殊情況 |

Production 不應使用：

```bash
prisma migrate reset
```

因為這會清除資料。

---

# `prisma migrate deploy` 會刪除我的 Production Data 嗎？

它**不會自己把整個 Database Reset**。

但是要注意：

> 它會忠實執行你 migration 裡的 SQL。

如果某次 migration 本身寫了：

```sql
DROP TABLE ...
```

或刪除欄位：

```sql
DROP COLUMN ...
```

那執行後仍然可能造成資料遺失。

所以正式專案在 Push migration 前，仍應該確認 migration 內容是否符合預期。

---

# Migration 為什麼一定要放 GitHub？

因為：

```text
prisma/schema.prisma
```

表示的是：

> Database 最後應該長什麼樣子。

而：

```text
prisma/migrations/
```

記錄的是：

> Database 是如何一步一步走到現在這個樣子的。

Production 的：

```bash
prisma migrate deploy
```

就是靠這些 migration files 工作。

因此：

```text
prisma/migrations/
```

應該 Push 到 GitHub。

但是：

```text
Production Database 的實際資料
```

不會因此進 GitHub。

---

# 補充三：Migration 和 Seed 是兩件不同的事

這也很重要。

## Migration

負責：

```text
建立 User table
建立 Course table
建立欄位
建立關聯
```

也就是：

```text
Database 結構
```

---

## Seed

負責：

```text
建立第一個 ADMIN
```

也就是：

```text
初始資料
```

所以第一次 Production 初始化會是：

```text
prisma migrate deploy
↓
資料表建立完成
↓
npm run db:seed
↓
建立 ADMIN
```

這就是為什麼前面的部署流程中：

```text
Migration
```

可以每次部署檢查；

但：

```text
Seed
```

我們只在第一次初始化時手動執行。

---

# 補充四：目前最適合 AnnotaLearn 的簡單流程

目前不用把部署想得太複雜。

你可以先維持：

```text
本機
  │
  │ git push
  ▼
GitHub main
  │
  ▼
Vercel Production
  │
  ├─ PostgreSQL
  └─ Private Blob
```

也就是：

```text
1. 本機修改
2. 本機測試
3. Push main
4. Vercel 自動執行 migrate deploy
5. Vercel Build
6. 正式網站更新
```

目前可以先不使用：

```text
Preview
Staging
Preview Database
Preview Blob
```

等專案真的需要 Branch / Pull Request 工作流程時，再增加即可。

---

# Production 最終檢查表

第一次正式上線前確認：

- [ ] GitHub Repository 已連接 Vercel
- [ ] Framework 是 Next.js
- [ ] Production PostgreSQL 已建立
- [ ] `DATABASE_URL` 已設定
- [ ] `SESSION_SECRET` 已設定
- [ ] `ADMIN_USERNAME` 已設定
- [ ] `ADMIN_PASSWORD` 已設定
- [ ] `STORAGE_DRIVER=blob`
- [ ] `NEXT_PUBLIC_STORAGE_DRIVER=blob`
- [ ] Build Command 為 `npm run db:deploy && npm run build`
- [ ] 第一次 Deploy 成功
- [ ] Private Blob Store 已建立
- [ ] `BLOB_READ_WRITE_TOKEN` 已加入
- [ ] Blob 建立後已 Redeploy
- [ ] 已執行 `vercel env run -e production -- npm run db:seed`
- [ ] `/admin` 可以登入
- [ ] PDF 可以上傳
- [ ] PDF 可以正常閱讀
- [ ] Production DB 與本機 Docker DB 是不同的資料庫

完成以上項目後，AnnotaLearn 的基本 Vercel Production 部署就完成了。

---

# 官方參考資料

Vercel：

- Environment Variables  
  https://vercel.com/docs/environment-variables
- Preview Deployments / Environments  
  https://vercel.com/docs/deployments/environments
- Vercel CLI Environment Variables  
  https://vercel.com/docs/cli/env
- Vercel Blob  
  https://vercel.com/docs/vercel-blob
- Vercel Private Blob  
  https://vercel.com/docs/vercel-blob/private-storage

Prisma：

- Deploy to Vercel  
  https://www.prisma.io/docs/orm/prisma-client/deployment/serverless/deploy-to-vercel
- Deploying database changes with Prisma Migrate  
  https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate
- Prisma Migrate — Development and Production  
  https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production
- `prisma migrate deploy`  
  https://www.prisma.io/docs/cli/migrate/deploy
