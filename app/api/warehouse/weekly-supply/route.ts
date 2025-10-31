import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isoYearWeekToMonday, diffIsoWeeks } from "@/lib/iso";
import { ZONE_RANCHES } from "@/lib/zones";
import { temporalidadCoincide } from "@/lib/temporalidad";

type ProdClass = "AGROQUIMICO" | "FERTILIZANTE";
type ProductLite = { id: string; name: string; unit: string | null; classification: ProdClass };
type RecipeItemLite = { productId: string; qtyPerHectare: number | string; product: ProductLite };
type RecipeWithItems = {
  id: string; name: string; cropId: string; varietyId: string | null;
  growthWeek: number; temporalidad: string | null; classification: ProdClass; items: RecipeItemLite[];
};

// ---------------- helpers ----------------
// Antes:
// function pickRecipesByTemporalidad(cropId, varietyId, growthWeek, byKey, sowingDate): RecipeWithItems[]

// Después:
function pickRecipesByTemporalidad(
  cropId: string,
  varietyId: string | null,
  growthWeek: number,
  byKey: Map<string, RecipeWithItems[]>,
  weekStart: Date,
  weekEnd: Date
): RecipeWithItems[] {
  const keyVar = `${cropId}|${varietyId ?? "null"}|${growthWeek}`;
  const keyGen = `${cropId}|null|${growthWeek}`;
  const candidates: RecipeWithItems[] = [
    ...(byKey.get(keyVar) ?? []),
    ...(byKey.get(keyGen) ?? []),
  ];
  if (candidates.length === 0) return [];

  // 1) Filtra por temporalidad de la SEMANA (cualquier día del rango semanal)
  const matching = candidates.filter(r =>
    temporalidadCoincideEnRango(r.temporalidad ?? null, weekStart, weekEnd)
  );
  if (matching.length) return matching;

  // 2) Fallback: ANUAL / sin temporalidad
  const annualish = candidates.filter(
    r => !r.temporalidad || r.temporalidad.trim() === "" || r.temporalidad.toUpperCase() === "ANUAL"
  );
  if (annualish.length) return annualish;

  return [];
}

// Coincidencia de temporalidad si al menos 1 día del rango [start, end] cae dentro
function temporalidadCoincideEnRango(
  temporalidad: string | null | undefined,
  start: Date,
  end: Date
): boolean {
  const oneDay = 24 * 60 * 60 * 1000;
  for (let t = start.getTime(); t <= end.getTime(); t += oneDay) {
    const d = new Date(t);
    if (temporalidadCoincide(temporalidad ?? null, d)) return true;
  }
  return false;
}

async function resolveZoneRanches(zone: "A" | "B"): Promise<{ ids: string[]; names: string[] }> {
  const raw = ZONE_RANCHES[zone] ?? [];
  if (raw.length === 0) return { ids: [], names: [] };
  const probablyIds = raw.filter(v => /^[a-z0-9]{10,}$/i.test(v));
  const probablyNames = raw.filter(v => !/^[a-z0-9]{10,}$/i.test(v));
  let resolvedFromNames: { id: string; name: string }[] = [];
  if (probablyNames.length > 0) {
    const ranchesByName = await prisma.ranch.findMany({
      where: { name: { in: probablyNames } },
      select: { id: true, name: true },
    });
    resolvedFromNames = ranchesByName;
  }
  const ids = [...probablyIds, ...resolvedFromNames.map(r => r.id)];
  const names = [...probablyNames, ...resolvedFromNames.map(r => r.name)];
  return { ids: Array.from(new Set(ids)), names: Array.from(new Set(names)) };
}

function mondayOf(d: Date, isoYearHint?: number) {
  const y = isoYearHint ?? d.getUTCFullYear();
  const base = isoYearWeekToMonday(y, 1);
  const w = Math.max(1, Math.min(53, Math.floor((d.getTime() - base.getTime()) / (7*24*3600*1000)) + 1));
  return isoYearWeekToMonday(y, w);
}
function addWeeks(d: Date, w: number) {
  const nd = new Date(d);
  nd.setUTCDate(nd.getUTCDate() + 7 * w);
  return nd;
}
function weeksInIsoYear(year: number) {
  const start = isoYearWeekToMonday(year, 1);
  const next = isoYearWeekToMonday(year + 1, 1);
  return Math.round((next.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000));
}
function isoKey(year: number, week: number) {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const ranchId = sp.get("ranchId") || undefined;
  const cropId  = sp.get("cropId")  || undefined;
  const zoneParam = sp.get("zone");
  const zone = (zoneParam === "A" || zoneParam === "B") ? zoneParam : undefined;

  const scope = (sp.get("scope") === "year") ? "year" : "week";

  const year = Number(sp.get("year")) || new Date().getUTCFullYear();
  const week = Number(sp.get("week")) || 1;

  // Rango semanal
  const mondayWeek = isoYearWeekToMonday(year, week);
  const sundayWeek = new Date(mondayWeek); sundayWeek.setUTCDate(mondayWeek.getUTCDate() + 6);

  // Rango anual (ISO)
  const mondayYear = isoYearWeekToMonday(year, 1);
  const mondayNextYear = isoYearWeekToMonday(year + 1, 1);
  const sundayYear = new Date(mondayNextYear); sundayYear.setUTCDate(mondayNextYear.getUTCDate() - 1);

  // Rango de semanas dentro del año (opcional)
  const totalWeeks = weeksInIsoYear(year);
  const weekStart = Math.max(1, Math.min(totalWeeks, Number(sp.get("weekStart")) || 1));
  const weekEnd   = Math.max(weekStart, Math.min(totalWeeks, Number(sp.get("weekEnd")) || totalWeeks));

  // --- filtro rancho / zona
  let ranchWhere: Record<string, any> = {};
  let ranchIdsUsed: string[] = [];
  let ranchNamesUsed: string[] = [];
  let zoneUsed: "A" | "B" | undefined = undefined;
  if (ranchId) {
    ranchWhere = { ranchId };
    ranchIdsUsed = [ranchId];
  } else if (zone) {
    const resolved = await resolveZoneRanches(zone);
    ranchIdsUsed = resolved.ids;
    ranchNamesUsed = resolved.names;
    zoneUsed = zone;
    ranchWhere = ranchIdsUsed.length > 0
      ? { ranchId: { in: ranchIdsUsed } }
      : { ranchId: { in: ["___NO_MATCH___"] } };
  }

  const rangeStart = (scope === "year") ? mondayYear : mondayWeek;
  const rangeEnd   = (scope === "year") ? sundayYear : sundayWeek;

  // 1) Siembras vivas en el rango
  const plantings = await prisma.planting.findMany({
    where: {
      status: "ACTIVE",
      sowingDate: { lte: rangeEnd },
      harvestDate: { gte: rangeStart },
      ...(Object.keys(ranchWhere).length ? ranchWhere : {}),
      ...(cropId ? { cropId } : {}),
    },
    select: {
      id: true, cropId: true, varietyId: true, ranchId: true, plotId: true,
      hectares: true, sowingDate: true, harvestDate: true,
    },
  });

  if (plantings.length === 0) {
    const columns = scope === "week"
      ? [isoKey(year, week)]
      : Array.from({length: (weekEnd - weekStart + 1)}, (_,i) => isoKey(year, weekStart + i));
    return NextResponse.json({
      year, week, columns, totals: [],
      meta: { countPlantings: 0, zoneUsed, ranchIdsUsed, ranchNamesUsed, scope, weekStart, weekEnd },
    });
  }

  // 2) Edades/crops necesarios
  const cropIds = new Set<string>();
  const neededAges = new Set<number>();
  if (scope === "week") {
    for (const p of plantings) {
      cropIds.add(p.cropId);
      const age = Math.max(1, diffIsoWeeks(new Date(p.sowingDate), mondayWeek) + 1);
      neededAges.add(age);
    }
  } else {
    for (const p of plantings) {
      cropIds.add(p.cropId);
      const sowMon = mondayOf(new Date(p.sowingDate));
      let overlapStart = new Date(Math.max(mondayYear.getTime(), sowMon.getTime()));
      let overlapEnd = new Date(Math.min(sundayYear.getTime(), new Date(p.harvestDate).getTime()));
      overlapEnd = mondayOf(overlapEnd);
      if (overlapEnd.getTime() < overlapStart.getTime()) continue;
      const weeksCount = diffIsoWeeks(overlapStart, overlapEnd) + 1;
      for (let i = 0; i < weeksCount; i++) {
        const weekMon = addWeeks(overlapStart, i);
        const age = Math.max(1, diffIsoWeeks(new Date(p.sowingDate), weekMon) + 1);
        neededAges.add(age);
      }
    }
  }

  // 3) Prefetch recetas
  const recipes = await prisma.recipe.findMany({
    where: {
      isActive: true,
      growthWeek: { in: Array.from(neededAges) },
      cropId: { in: Array.from(cropIds) },
    },
    include: { items: { include: { product: true } } },
  }) as unknown as RecipeWithItems[];

  // index por clave
  const byKey = new Map<string, RecipeWithItems[]>();
  for (const r of recipes) {
    const key = `${r.cropId}|${r.varietyId ?? "null"}|${r.growthWeek}`;
    const list = byKey.get(key) ?? [];
    list.push(r);
    byKey.set(key, list);
  }

  // 4) Agregación pivot (producto x semana)
  type Source = {
    recipeId: string; recipeName: string; temporalidad: string;
    growthWeek: number; classification: ProdClass;
    totalFromThisRecipe: number; occurrences: number;
  };
  type Row = {
    productId: string; name: string; unit: string; classification: ProdClass;
    total: number; cells: Map<string, number>; _sources: Map<string, Source>;
  };
  const totals = new Map<string, Row>();

  function addCell(rec: RecipeWithItems, it: RecipeItemLite, qty: number, iso: string) {
    const prodId = it.productId;
    let row = totals.get(prodId);
    if (!row) {
      row = {
        productId: prodId,
        name: it.product.name,
        unit: it.product.unit ?? "",
        classification: it.product.classification,
        total: 0,
        cells: new Map<string, number>(),
        _sources: new Map<string, Source>(),
      };
      totals.set(prodId, row);
    }
    row.total += qty;
    row.cells.set(iso, (row.cells.get(iso) ?? 0) + qty);

    const sKey = rec.id;
    const ex = row._sources.get(sKey);
    if (ex) {
      ex.totalFromThisRecipe += qty;
      ex.occurrences += 1;
    } else {
      row._sources.set(sKey, {
        recipeId: rec.id,
        recipeName: rec.name,
        temporalidad: rec.temporalidad ?? "",
        growthWeek: rec.growthWeek,
        classification: rec.classification,
        totalFromThisRecipe: qty,
        occurrences: 1,
      });
    }
  }

  // columnas objetivo
  const columns: string[] =
    (scope === "week")
      ? [isoKey(year, week)]
      : Array.from({length: (weekEnd - weekStart + 1)}, (_,i) => isoKey(year, weekStart + i));

  const columnSet = new Set(columns);

  if (scope === "week") {
    for (const p of plantings) {
      const age = Math.max(1, diffIsoWeeks(new Date(p.sowingDate), mondayWeek) + 1);
      const recs = pickRecipesByTemporalidad(
      p.cropId,
      p.varietyId ?? null,
      age,
      byKey,
      mondayWeek,
      sundayWeek
    );

      for (const rec of recs) {
        for (const it of (rec.items ?? [])) {
          const add = Number(it.qtyPerHectare) * Number(p.hectares);
          addCell(rec, it, add, columns[0]);
        }
      }
    }
  } else {
    const sowCache = new Map<string, Date>();
    for (const p of plantings) {
      const sow = sowCache.get(p.id) ?? new Date(p.sowingDate);
      if (!sowCache.has(p.id)) sowCache.set(p.id, sow);

      // limitar semanas a [weekStart, weekEnd]
      for (let w = weekStart; w <= weekEnd; w++) {
        const weekMon = isoYearWeekToMonday(year, w);
        // fuera del overlap siembra-cosecha => skip
        if (weekMon < mondayOf(new Date(p.sowingDate)) || weekMon > mondayOf(new Date(p.harvestDate))) continue;

        const age = Math.max(1, diffIsoWeeks(new Date(p.sowingDate), weekMon) + 1);
        const recs = pickRecipesByTemporalidad(
        p.cropId,
        p.varietyId ?? null,
        age,
        byKey,
        mondayWeek,
        sundayWeek
      );

        if (recs.length === 0) continue;

        const key = isoKey(year, w);
        if (!columnSet.has(key)) continue;

        for (const rec of recs) {
          for (const it of (rec.items ?? [])) {
            const add = Number(it.qtyPerHectare) * Number(p.hectares);
            addCell(rec, it, add, key);
          }
        }
      }
    }
  }

  // serializar
  const rows = Array.from(totals.values()).map(r => ({
    productId: r.productId,
    name: r.name,
    unit: r.unit,
    classification: r.classification,
    total: r.total,
    cells: Object.fromEntries(r.cells),
    sources: Array.from(r._sources.values()).sort((a,b) => a.recipeName.localeCompare(b.recipeName)),
  })).sort((a,b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    year, week, columns,
    totals: rows,
    meta: { countPlantings: plantings.length, zoneUsed, ranchIdsUsed, ranchNamesUsed, scope, weekStart, weekEnd },
  });
}
