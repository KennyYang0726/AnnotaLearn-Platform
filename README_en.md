<div align="right">
<a href="README.md">繁體中文</a> · 
<strong>English</strong>
</div>

<div align="center">

# AnnotaLearn

**A self-hosted learning platform centered on PDF reading, annotation, note-taking, and learning behavior analytics**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

</div>

AnnotaLearn is a course-material-centered learning platform that allows students to highlight key points and questions directly on PDF materials, create text notes, record page-level comprehension states, and preserve reading activity data for later review and analysis by instructors and teaching assistants.

The current interface is primarily written in **Traditional Chinese**, and the default application timezone is `Asia/Taipei`.

## Features

- **PDF reading and annotation**: Key-point/question highlights, undo last annotation, text notes, and question notes.
- **Responsive reader**: Supports desktop, tablet, and mobile layouts, including touch interaction, document panning, and pinch-to-zoom.
- **Comprehension tracking**: Records page-level “I understand / I do not understand” states and preserves state-change history.
- **Reading behavior tracking**: Page dwell time, heartbeat tracking, completion rate, and daily learning activity.
- **Course and roster management**: Semesters, courses, students, teaching assistants, course assignments, and XLS / XLSX roster import.
- **Shared PDF asset library**: The same material can be reused across multiple courses while preserving uploader ownership and access permissions.
- **Instructor analytics views**: Reading activity, submissions, notes, highlights, and comprehension summaries with CSV export based on authorization scope.
- **Course-scoped TA permissions**: Teaching assistants can only access courses assigned to them and do not receive platform-wide administrative privileges.

## Roles and Permissions

| Role | Access |
| --- | --- |
| `ADMIN` | Full platform administration: semesters, courses, students, teaching assistants, PDF assets, and learning data |
| `TA` | Limited to assigned courses; can review and manage course materials and learning data within those courses |
| `STUDENT` | Limited to enrolled courses; can read materials, annotate, take notes, and submit work |

All course-level administrative actions are authorized on the server side and do not rely solely on hidden frontend controls.

## Technology Stack

| Component | Technology |
| --- | --- |
| Web | Next.js 16 / React 19 / TypeScript |
| Database | PostgreSQL 17 |
| ORM | Prisma 7 |
| PDF | PDF.js (`pdfjs-dist`) |
| Auth | Cookie-based session / `jose` |
| Deployment | Docker Compose |
| File Storage | Ubuntu local filesystem `storage/uploads/` |

## Ubuntu Deployment

### Requirements

- Ubuntu
- Git
- Docker Engine
- Docker Compose Plugin

Verify Docker:

```bash
docker version
docker compose version
```

If Docker currently requires `sudo`, add your user to the `docker` group:

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

After signing in again, Docker commands can be used without `sudo`.

### 1. Clone the Repository

```bash
git clone <repository-url>
cd AnnotaLearn-Platform
```

### 2. Configure the Environment

```bash
cp .env.example .env
nano .env
```

At minimum, update:

```env
POSTGRES_PASSWORD="change-your-database-password"
SESSION_SECRET="replace-with-a-random-string-at-least-32-characters-long"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="change-your-initial-admin-password"
APP_TIMEZONE="Asia/Taipei"
APP_PORT="3000"
```

Available settings:

| Variable | Description | Default |
| --- | --- | --- |
| `POSTGRES_USER` | PostgreSQL user | `annotalearn` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `annotalearn`; change this in production |
| `POSTGRES_DB` | PostgreSQL database name | `annotalearn` |
| `POSTGRES_PORT` | PostgreSQL host port | `5432` |
| `SESSION_SECRET` | Session signing secret | Must be configured manually |
| `ADMIN_USERNAME` | Initial administrator username | `admin` |
| `ADMIN_PASSWORD` | Initial administrator password | Must be configured manually |
| `APP_TIMEZONE` | IANA timezone used for application time and daily analytics | `Asia/Taipei` |
| `APP_PORT` | Web host port | `3000` |

`.env` is excluded by `.gitignore`. Do not commit real passwords or secrets.

### 3. Build and Start

```bash
docker compose build app
docker compose up -d postgres
docker compose run --rm app npm run db:deploy
docker compose run --rm app npm run db:seed
docker compose up -d app
```

Check service status:

```bash
docker compose ps
docker compose logs --tail=100 app
```

By default, the application is bound locally at:

```text
http://127.0.0.1:3000
```

If you use Cloudflare Tunnel or another reverse proxy, point the upstream service to the address above.

> `db:seed` is only required for the first deployment of a new database. It creates the initial administrator using `ADMIN_USERNAME` and `ADMIN_PASSWORD` from `.env`.

## Updating

After pulling a newer version:

```bash
git pull
docker compose build app
docker compose run --rm app npm run db:deploy
docker compose up -d app
docker compose ps
```

Most updates do not require running `db:seed` again.

## Data Persistence

PostgreSQL uses the Docker named volume:

```text
annotalearn_pgdata
```

Uploaded PDF files are stored in:

```text
storage/uploads/
```

Rebuilding the application image or recreating the application container does not remove the database or uploaded materials.

### Back Up PostgreSQL

```bash
docker compose exec -T postgres sh -lc \
'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
> ~/annotalearn.dump
```

### Back Up Uploaded PDFs

```bash
cp -a storage/uploads ~/annotalearn-uploads-backup
```

Database dumps, uploaded PDFs, `.env`, and other backup data should not be committed to Git.

## Repository and Git Data

Files that should remain in the repository:

- `.env.example`
- `prisma/schema.prisma`
- `prisma/migrations/`
- `prisma/seed.ts`
- `package.json`
- `package-lock.json`
- `storage/uploads/.gitkeep`

Files that should not be committed:

- `.env`
- `node_modules/`
- `.next/`
- `generated/prisma/`
- Actual PDF files under `storage/uploads/`
- PostgreSQL dumps / backups

`prisma/migrations/` contains database schema changes only. It does not contain student records, courses, notes, annotations, or reading activity data.

## Timezone

Course start/end times, time displays, date filters, and daily learning activity grouping are controlled by:

```env
APP_TIMEZONE="Asia/Taipei"
```

You may change this to another IANA timezone. Once real learning data collection has started, changing the platform timezone is not recommended because it may shift day boundaries used in analytics.

## License

This project is licensed under the [MIT License](LICENSE).
