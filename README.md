
# Agro • Paquetes por Semana (React + Next.js + Tailwind + Prisma)

Proyecto base para seleccionar una **semana ISO (YYYY-Www)** y ver **siembras vivas** con sus **paquetes/recetas** aplicables según la **semana de crecimiento**.

## Requisitos
- Node.js >= 18.18
- Docker (para la base de datos Postgres)
- npm

## 1) Levantar Base de Datos con Docker
```bash
docker compose up -d
# DB: postgres://postgres:postgres@localhost:5432/agro_db
# Adminer en http://localhost:8080 (System: PostgreSQL, Server: db, User: postgres, Pass: postgres, DB: agro_db)
```

## 2) Configurar el proyecto
```bash
cp .env.example .env
npm install
```

## 3) Prisma: migraciones y seed
```bash
npx prisma migrate dev --name init
npm run seed
# opcional: npx prisma studio
```

## 4) Correr en desarrollo
```bash
npm run dev
# abrir http://localhost:3000
```

## Estructura
- `app/plan/page.tsx` UI para seleccionar semana y ver plan.
- `app/api/weekly-plan/route.ts` endpoint que recibe `?iso=YYYY-Www`.
- `lib/weeks.ts` utilidades para semana ISO y semana de crecimiento.
- `prisma/schema.prisma` modelos (Ranch, Plot, Crop, Variety, Planting, Product, Recipe, RecipeItem).

## Notas
- El cálculo de la **semana de crecimiento** se hace con el **lunes** de la semana ISO seleccionada.
- El endpoint considera recetas para la **variedad específica** y también **recetas generales** por cultivo (`varietyId: null`).
- Puedes extender el modelo con costos, roles/permisos y agregados de almacén por semana.
