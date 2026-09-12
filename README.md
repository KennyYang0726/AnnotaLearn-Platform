<div align="right">
<strong>繁體中文</strong> · 
<a href="README_en.md">English</a>
</div>

<div align="center">

# AnnotaLearn

**以 PDF 教材閱讀、劃記、筆記與學習行為分析為核心的自架教學平台**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

</div>

AnnotaLearn 是一套以課程教材為中心的教學平台，讓學生直接在 PDF 上進行重點／疑問劃記、文字筆記與理解狀態紀錄，同時保留閱讀停留與學習活動資料，供教師與助教後續檢視與分析。

目前介面以 **繁體中文** 為主，預設平台時區為 `Asia/Taipei`。

## 功能特色

- **PDF 閱讀與註記**：重點／疑問劃記、復原上一筆劃記、文字筆記、盲點提問。
- **響應式閱讀器**：支援桌面、平板與行動裝置，包含觸控操作、畫面平移與雙指縮放。
- **理解狀態**：逐頁記錄「我懂了／我不懂」，並保存狀態變更歷程。
- **閱讀行為紀錄**：頁面停留時間、Heartbeat、完成率與每日學習活動。
- **課程與名單管理**：學期、課程、學生、助教、課程分配，以及 XLS / XLSX 名單匯入。
- **共用 PDF 資產庫**：同一份教材可被多門課程引用，並保留資產上傳者與操作權限。
- **教師資料檢視**：閱讀、繳交、筆記、劃記與理解狀態總覽，可依授權範圍匯出 CSV。
- **課程級助教權限**：TA 僅能存取被分配的課程，不會取得全站管理權限。

## 角色與權限

| 角色 | 權限範圍 |
| --- | --- |
| `ADMIN` | 全平台管理：學期、課程、學生、助教、教材資產與學習資料 |
| `TA` | 僅限被分配的課程，可查看與管理該課程的教材及學習資料 |
| `STUDENT` | 僅限已加入的課程，可閱讀教材、劃記、筆記與繳交 |

所有課程級管理操作皆在伺服器端進行授權檢查，不只依賴前端介面隱藏。

## 技術架構

| 項目 | 技術 |
| --- | --- |
| Web | Next.js 16 / React 19 / TypeScript |
| Database | PostgreSQL 17 |
| ORM | Prisma 7 |
| PDF | PDF.js (`pdfjs-dist`) |
| Auth | Cookie-based session / `jose` |
| Deployment | Docker Compose |
| File Storage | Ubuntu 本機檔案系統 `storage/uploads/` |

## Ubuntu 部署

### 系統需求

- Ubuntu
- Git
- Docker Engine
- Docker Compose Plugin

確認 Docker：

```bash
docker version
docker compose version
```

若目前 Docker 必須使用 `sudo`，可將目前帳號加入 `docker` 群組：

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

重新登入後即可直接使用 `docker` 指令。

### 1. 取得專案

```bash
git clone https://github.com/KennyYang0726/AnnotaLearn-Platform.git
cd AnnotaLearn-Platform
```

### 2. 建立環境設定

```bash
cp .env.example .env
nano .env
```

至少請修改：

```env
POSTGRES_PASSWORD="請更換資料庫密碼"
SESSION_SECRET="請更換為至少 32 字元的隨機字串"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="請更換初始管理員密碼"
APP_TIMEZONE="Asia/Taipei"
APP_PORT="3000"
```

完整可設定項目：

| 變數 | 說明 | 預設值 |
| --- | --- | --- |
| `POSTGRES_USER` | PostgreSQL 使用者 | `annotalearn` |
| `POSTGRES_PASSWORD` | PostgreSQL 密碼 | `annotalearn`，正式環境務必修改 |
| `POSTGRES_DB` | PostgreSQL 資料庫名稱 | `annotalearn` |
| `POSTGRES_PORT` | PostgreSQL 主機連接埠 | `5432` |
| `SESSION_SECRET` | Session 簽章密鑰 | 必須自行設定 |
| `ADMIN_USERNAME` | 初始管理員帳號 | `admin` |
| `ADMIN_PASSWORD` | 初始管理員密碼 | 必須自行設定 |
| `APP_TIMEZONE` | 平台時間與每日分析使用的 IANA timezone | `Asia/Taipei` |
| `APP_PORT` | Web 主機連接埠 | `3000` |

`.env` 已由 `.gitignore` 排除，請勿提交真實密碼或密鑰。

### 3. 建置並啟動

```bash
docker compose build app
docker compose up -d postgres
docker compose run --rm app npm run db:deploy
docker compose run --rm app npm run db:seed
docker compose up -d app
```

檢查服務：

```bash
docker compose ps
docker compose logs --tail=100 app
```

預設網站僅綁定本機：

```text
http://127.0.0.1:3000
```

若使用 Cloudflare Tunnel 或其他反向代理，可將來源服務指向上述位址。

> `db:seed` 僅需在全新資料庫第一次部署時執行。它會依 `.env` 中的 `ADMIN_USERNAME` 與 `ADMIN_PASSWORD` 建立初始管理員。

## 更新部署

取得新版程式碼後：

```bash
git pull
docker compose build app
docker compose run --rm app npm run db:deploy
docker compose up -d app
docker compose ps
```

一般更新不需要再次執行 `db:seed`。

## 資料保存

PostgreSQL 使用 Docker named volume：

```text
annotalearn_pgdata
```

上傳的 PDF 儲存在：

```text
storage/uploads/
```

因此重新建置 App image 或重新建立 App container 不會清除資料庫與教材。

### 備份 PostgreSQL

```bash
docker compose exec -T postgres sh -lc \
'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
> ~/annotalearn.dump
```

### 備份 PDF

```bash
cp -a storage/uploads ~/annotalearn-uploads-backup
```

實際 DB dump、PDF、`.env` 與其他備份資料不應提交到 Git。

## 專案資料與 Git

應保留在 Repository：

- `.env.example`
- `prisma/schema.prisma`
- `prisma/migrations/`
- `prisma/seed.ts`
- `package.json`
- `package-lock.json`
- `storage/uploads/.gitkeep`

不應提交：

- `.env`
- `node_modules/`
- `.next/`
- `generated/prisma/`
- `storage/uploads/` 中的實際 PDF
- PostgreSQL dump / backup

`prisma/migrations/` 僅記錄資料庫結構變更，不包含學生、課程、筆記、劃記或閱讀資料。

## 時區

課程起訖、時間顯示、日期篩選與每日學習活動歸日，統一由：

```env
APP_TIMEZONE="Asia/Taipei"
```

控制。可改為其他 IANA timezone。正式開始蒐集學習資料後，不建議中途更換平台時區，以免造成跨日分析基準不一致。

## License

本專案採用 [MIT License](LICENSE)。
