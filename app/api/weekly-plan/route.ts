import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isoWeekRange, growthWeekFor, isActiveInRange } from "@/lib/weeks";
import { temporalidadCoincide } from "@/lib/temporalidad";


// Valida si la temporalidad coincide con CUALQUIER día del rango semanal
function temporalidadCoincideEnRango(temporalidad: string | null | undefined, start: Date, end: Date): boolean {
  // Si es "Anual" o vacío, ya tu temporalidadCoincide() nos regresa true, pero
  // igual hacemos la iteración por si en el futuro quieres cambiar esa regla.
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

  // Helper: prioriza recetas por temporalidad según la semana consultada (rango semanal)
  function pickByTemporalidad(
    list: typeof recipes[number][],
    weekStart: Date,
    weekEnd: Date
  ) {
    if (!list?.length) return [];

    // 1) Coinciden con la temporalidad de la SEMANA (cualquier día del rango semanal)
    const matches = list.filter(r => temporalidadCoincideEnRango(r.temporalidad ?? null, weekStart, weekEnd));
    if (matches.length) return matches;

    // 2) Fallback: ANUAL / sin temporalidad
    const annual = list.filter(
      r => !r.temporalidad || r.temporalidad.trim() === "" || r.temporalidad.toUpperCase() === "ANUAL"
    );
    if (annual.length) return annual;

    // 3) Nada coincide
    return [];
  }


  // 3) Armar respuesta por siembra
  const result = alive.map(a => {
    const p = a.planting;
    const kSpec = key(p.cropId, p.varietyId, a.growthWeek); // variedad específica
    const kGen  = key(p.cropId, null, a.growthWeek);        // general del cultivo
    
    // Recetas candidatas (específicas + generales)
    const candidates = (map.get(kSpec) ?? []).concat(map.get(kGen) ?? []);

    // Filtrar/priorizar por temporalidad según fecha de siembra
    const effective = pickByTemporalidad(candidates, start, end);

    const hectares = Number(p.hectares);
    const packages = effective.map(r => ({
      id: r.id,
      name: r.name,
      classification: r.classification,
      growthWeek: r.growthWeek,
      temporalidad: r.temporalidad ?? "Anual",
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
