# API

NestJS API cho hệ thống quản lý võ đường Karate.

## Chạy
```bash
pnpm install
copy .env.example .env
pnpm start:dev
```

API mặc định: `http://localhost:3000/api`

## Endpoint demo
- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/students`
- `GET /api/classes`
- `GET /api/attendance/today`
- `PATCH /api/attendance/:studentId`
- `GET /api/tuition`
- `GET /api/finance`
- `GET /api/reports`

Dữ liệu nghiệp vụ bản 0.1 đang là demo in-memory. Prisma schema đã sẵn sàng để chuyển sang PostgreSQL.
