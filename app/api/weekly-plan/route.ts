import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isoWeekRange, growthWeekFor, isActiveInRange } from "@/lib/weeks";
import { temporalidadCoincide } from "@/lib/temporalidad";

// ✅ Helper: detectar si un rancho es invernadero por nombre
function isGreenhouseRanchName(name?: string | null): boolean {
  if (!name) return false;
  return /invernadero/i.test(name); // ajusta si tienes una regla distinta
}

// ✅ Helper: normalizar sowingType
function normalizeSowingType(s?: string | null): "INVERNADERO" | "CAMPO ABIERTO" | null {
  if (!s) return null;
  const t = s.trim().toUpperCase();
  if (t === "INVERNADERO") return "INVERNADERO";
  if (t === "CAMPO ABIERTO") return "CAMPO ABIERTO";
  return null; // si viene algo raro, lo descartamos
}

// Valida si la temporalidad coincide con CUALQUIER día del rango semanal
function temporalidadCoincideEnRango(temporalidad: string | null | undefined, start: Date, end: Date): boolean {
  const oneDay = 24 * 60 * 60 * 1000;
  for (let t = start.getTime(); t <= end.getTime(); t += oneDay) {
    const d = new Date(t);
    if (temporalidadCoincide(temporalidad ?? null, d)) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const iso = req.nextUrl.searchParams.get("iso");
  if (!iso) {
    return NextResponse.json({ error: "Falta parámetro ?iso=YYYY-Www" }, { status: 400 });
  }

  let range;
  try {
    range = isoWeekRange(iso);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  const { start, end } = range;
  const refDate = start; // Lunes de la ISO week

  // 1) Siembras vivas en la semana
  const plantings = await prisma.planting.findMany({
    where: {
      status: "ACTIVE",
      sowingDate: { lte: end },
      harvestDate: { gte: start },
    },
    include: {
      crop: true,
      variety: true,
      ranch: true,
      plot: true,
    },
    orderBy: { sowingDate: "asc" },
  });

  const alive = plantings
    .filter(p => isActiveInRange(start, end, p.sowingDate, p.harvestDate))
    .map(p => ({
      planting: p,
      growthWeek: growthWeekFor(refDate, p.sowingDate),
    }));

  // 2) Preparar filtros OR para traer solo recetas relevantes (por crop/variedad/growthWeek)
  const orFilters = alive.map(a => ({
    growthWeek: a.growthWeek,
    cropId: a.planting.cropId,
    OR: [{ varietyId: a.planting.varietyId }, { varietyId: null }],
  }));

  const recipes = orFilters.length
    ? await prisma.recipe.findMany({
        where: { isActive: true, OR: orFilters },
        include: { items: { include: { product: true } } },
      })
    : [];

  const key = (cropId: string, varietyId: string | null, gw: number) =>
    `${cropId}::${varietyId ?? "GEN"}::${gw}`;

  // Index (cropId, varietyId/null, growthWeek) → [recipes]
  const map = new Map<string, typeof recipes>();
  for (const r of recipes) {
    const k = key(r.cropId, r.varietyId, r.growthWeek);
    const list = map.get(k) ?? [];
    list.push(r);
    map.set(k, list);
  }

  // Prioriza por temporalidad (como ya tenías)
  function pickByTemporalidad(list: typeof recipes[number][], weekStart: Date, weekEnd: Date) {
    if (!list?.length) return [];
    const matches = list.filter(r => temporalidadCoincideEnRango(r.temporalidad ?? null, weekStart, weekEnd));
    if (matches.length) return matches;
    const annual = list.filter(
      r => !r.temporalidad || r.temporalidad.trim() === "" || r.temporalidad.toUpperCase() === "ANUAL"
    );
    if (annual.length) return annual;
    return [];
  }

  // 3) Armar respuesta por siembra con filtro por sowingType
  const result = alive.map(a => {
    const p = a.planting;
    const kSpec = key(p.cropId, p.varietyId, a.growthWeek); // variedad específica
    const kGen  = key(p.cropId, null, a.growthWeek);        // general del cultivo

    const candidates = (map.get(kSpec) ?? []).concat(map.get(kGen) ?? []);

    // ✅ Filtrar por tipo de siembra según el rancho
    const greenhouse = isGreenhouseRanchName(p.ranch?.name);
    const wanted: "INVERNADERO" | "CAMPO ABIERTO" = greenhouse ? "INVERNADERO" : "CAMPO ABIERTO";

    // Solo recetas cuyo sowingType normalizado coincide EXACTO con el deseado
    const bySowingType = candidates.filter(r => normalizeSowingType(r.sowingType ?? null) === wanted);

    // Luego aplica tu priorización por temporalidad dentro del subconjunto por tipo
    const effective = pickByTemporalidad(bySowingType, start, end);

    const hectares = Number(p.hectares);
    const packages = effective.map(r => ({
      id: r.id,
      name: r.name,
      classification: r.classification,
      growthWeek: r.growthWeek,
      temporalidad: r.temporalidad ?? "Anual",
      sowingType: normalizeSowingType(r.sowingType ?? null) ?? null, // opcional, por si quieres mostrarlo
      items: r.items.map(it => ({
        productId: it.productId,
        product: it.product.name,
        unit: it.product.unit,
        qtyPerHectare: Number(it.qtyPerHectare),
        qtyTotal: Number(it.qtyPerHectare) * hectares,
      })),
    }));

    return {
      planting: {
        id: p.id,
        crop: p.crop.name,
        variety: p.variety?.name ?? null,
        tabla: p.tabla ?? null,
        ranch: p.ranch.name,
        plot: p.plot.name,
        hectares,
        sowingDate: p.sowingDate,
        harvestDate: p.harvestDate,
      },
      growthWeek: a.growthWeek,
      packages,
    };
  });

  const totalHectares = result.reduce((acc, r) => acc + r.planting.hectares, 0);

  return NextResponse.json({
    isoWeek: iso,
    range: { start: start.toISOString(), end: end.toISOString() },
    totals: { plantings: result.length, hectares: totalHectares },
    plan: result,
  });
}
