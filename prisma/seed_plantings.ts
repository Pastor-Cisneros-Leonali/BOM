// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import * as path from "node:path";
import * as fs from "node:fs";
import XLSX from "xlsx";

const prisma = new PrismaClient();

const warnings: string[] = [];
function warn(msg: string) {
  warnings.push(msg);
  console.warn(msg);
}

const stripDiacritics = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "");

const norm = (v: any) => stripDiacritics(String(v ?? "").trim()).toUpperCase();

/** Mapea headers a claves canónicas */
function canonicalizeRow<T extends Record<string, any>>(row: T, dict: Record<string, string>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = String(k).trim().toLowerCase();
    const keyNoAcc = stripDiacritics(key);
    const canon = dict[key] ?? dict[keyNoAcc] ?? key;
    out[canon] = v;
  }
  return out as T;
}

/** Acepta 1, "1", "1,5" */
function toNumber(n: any, fallback = NaN) {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (n == null) return fallback;
  const s = String(n).trim().replace(",", ".");
  const x = Number(s);
  return Number.isFinite(x) ? x : fallback;
}

/** Normaliza string semana ISO a 'YYYY-W##' y devuelve Date (lunes de esa semana) */
function isoWeekToMondayDate(isoStrRaw: string, defaultYear: number): { isoKey: string; monday: Date } {
  const s = String(isoStrRaw ?? "").trim();
  const text = stripDiacritics(s).toUpperCase();

  let year: number | null = null;
  let week: number | null = null;

  const yearMatch = text.match(/\b(20\d{2}|19\d{2})\b/);
  if (yearMatch) year = Number(yearMatch[1]);

  const weekMatchW = text.match(/W\s*?(\d{1,2})/);
  const weekMatchPlain = text.match(/\b(\d{1,2})\b/);

  if (weekMatchW) {
    week = Number(weekMatchW[1]);
  } else if (weekMatchPlain) {
    const candidate = Number(weekMatchPlain[1]);
    if (candidate >= 1 && candidate <= 53) week = candidate;
  }

  if (!year) {
    year = defaultYear;
    warn(`Semana ISO "${s}": sin año → usando ${year}`);
  }
  if (!week || week < 1) {
    week = 1;
    warn(`Semana ISO "${s}": semana inválida → usando W01`);
  }

  const isoKey = `${year}-W${String(week).padStart(2, "0")}`;

  // Algoritmo estándar: tomar el jueves de la semana ISO y volver al lunes
  const simple = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = simple.getUTCDay() || 7; // 1..7 (lunes=1)
  const thursday = new Date(simple);
  thursday.setUTCDate(simple.getUTCDate() + (4 - dayOfWeek));

  const monday = new Date(thursday);
  monday.setUTCDate(thursday.getUTCDate() - 3 + (week - 1) * 7);

  return { isoKey, monday };
}

// ==== Aliases de headers (para la hoja Plantings) ====
const PLANTING_KEYS: Record<string, string> = {
  // canónicos
  crop: "crop",
  variety: "variety",
  ranch: "ranch",
  plot: "plot",
  hectares: "hectares",
  sowingisoweek: "sowingIsoWeek",
  harvestisoweek: "harvestIsoWeek",
  tabla: "tabla",

  // aliases ES / usados en BOM
  mp: "crop", // MP = cultivo
  cultivo: "crop",
  variedad: "variety",
  rancho: "ranch",
  lote: "plot",
  hectareas: "hectares",
  "hectáreas": "hectares",
  ha: "hectares",
  "semana siembra": "sowingIsoWeek",
  "semana_siembra": "sowingIsoWeek",
  "siembra_iso": "sowingIsoWeek",
  "s.siembra": "sowingIsoWeek",
  "semana cosecha": "harvestIsoWeek",
  "semana_cosecha": "harvestIsoWeek",
  "cosecha_iso": "harvestIsoWeek",
  "s.cosecha": "harvestIsoWeek",

  // extras que quizá te vengan en el archivo (no se usan en la clave lógica)
  "año siembra": "yearSowing",
  "anio siembra": "yearSowing",
  "año final": "yearFinal",
  "anio final": "yearFinal",
  "sem cosecha": "harvestIsoWeek",
  "fecha de pérdida": "lossDate",
  "semana pérdida": "lossIsoWeek",
};

// ==== Upserts de catálogos ====
async function upsertCropByName(name: string) {
  const n = String(name ?? "").trim();
  if (!n) throw new Error("Falta 'crop'");
  const ex = await prisma.crop.findFirst({ where: { name: n } });
  return ex ?? prisma.crop.create({ data: { name: n } });
}

async function upsertVarietyByName(cropId: string, name: string) {
  const n = String(name ?? "").trim();
  if (!n) return null;
  const ex = await prisma.variety.findFirst({ where: { cropId, name: n } });
  return ex ?? prisma.variety.create({ data: { cropId, name: n } });
}

async function upsertRanchByName(name: string) {
  const n = String(name ?? "").trim();
  if (!n) throw new Error("Falta 'ranch'");
  const ex = await prisma.ranch.findFirst({ where: { name: n } });
  return ex ?? prisma.ranch.create({ data: { name: n } });
}

/**
 * Devuelve el plot indicado por nombre;
 * si el nombre viene vacío, usa/crea un comodín "SIN LOTE" por rancho.
 */
const FALLBACK_PLOT_NAME = "SIN LOTE";
async function getPlotOrFallback(ranchId: string, plotNameRaw: string | null | undefined) {
  const name = String(plotNameRaw ?? "").trim();
  const finalName = name || FALLBACK_PLOT_NAME;

  let plot = await prisma.plot.findFirst({ where: { ranchId, name: finalName } });
  if (!plot) {
    // Hectáreas 0 por defecto para el comodín (ajusta si lo deseas)
    plot = await prisma.plot.create({
      data: { ranchId, name: finalName, hectares: 0 as any },
    });
  }
  return plot;
}

// ==== MAIN ====
async function main() {
  // Permite: SEED_XLSX=/ruta/al/archivo.xlsx  o  node seed.ts --xlsx=/ruta
  const argXlsx = process.argv.find((a) => a.startsWith("--xlsx="))?.split("=")[1];
  const xlsxPath =
    process.env.SEED_XLSX ||
    argXlsx ||
    path.join(process.cwd(), "prisma", "BOM.xlsx");

  if (!fs.existsSync(xlsxPath)) {
    throw new Error(
      `No se encontró el archivo: ${xlsxPath}. ` +
      `Define SEED_XLSX o pasa --xlsx=/ruta/al/BOM.xlsx`
    );
  }

  const wb = XLSX.readFile(xlsxPath, { cellDates: false });

  const sheetName = "Plantings";
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(`La hoja '${sheetName}' no existe en el Excel.`);
  }

  const rowsRaw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

  const yearNow = new Date().getFullYear();

  type PRow = {
    crop: string;
    variety?: string | null;
    ranch: string;
    plot?: string | null; // <- ahora opcional
    hectares: number;
    sowingIsoWeek: string;
    harvestIsoWeek: string;
    tabla?: string | null;
    row: number;
    yearSowing?: number | null;
    yearFinal?: number | null;
  };

  const plantings: PRow[] = [];

  rowsRaw.forEach((r0, idx) => {
    const rowNumber = idx + 2; // 1 es header
    const r = canonicalizeRow(r0, PLANTING_KEYS);

    const crop = String(r.crop ?? "").trim();
    const ranch = String(r.ranch ?? "").trim();
    const plot = String(r.plot ?? "").trim() || null; // <- acepta null

    if (!crop || !ranch) {
      warn(`Fila ${rowNumber}: faltan campos obligatorios (crop/ranch) → omitida`);
      return;
    }

    const variety = String(r.variety ?? "").trim() || null;

    const hectares = toNumber(r.hectares);
    if (!(Number.isFinite(hectares) && hectares > 0)) {
      warn(`Fila ${rowNumber}: 'hectares' inválido ("${r.hectares}") → omitida`);
      return;
    }

    const sowRaw = String(r.sowingIsoWeek ?? "").trim();
    const harRaw = String(r.harvestIsoWeek ?? "").trim();
    if (!sowRaw) {
      warn(`Fila ${rowNumber}: 'sowingIsoWeek' vacío → omitida`);
      return;
    }
    if (!harRaw) {
      warn(`Fila ${rowNumber}: 'harvestIsoWeek' vacío → omitida`);
      return;
    }

    const tabla = String(r.tabla ?? "").trim() || null;

    const yearSowing = Number.isFinite(Number(r.yearSowing)) ? Number(r.yearSowing) : null;
    const yearFinal = Number.isFinite(Number(r.yearFinal)) ? Number(r.yearFinal) : null;

    plantings.push({
      crop,
      variety,
      ranch,
      plot, // puede ser null → se usará el comodín
      hectares,
      sowingIsoWeek: sowRaw,
      harvestIsoWeek: harRaw,
      tabla,
      row: rowNumber,
      yearSowing,
      yearFinal,
    });
  });

  let created = 0;
  let updated = 0;

  for (const p of plantings) {
    // 1) Upserts de catálogos
    const crop = await upsertCropByName(p.crop);
    const variety = p.variety ? await upsertVarietyByName(crop.id, p.variety) : null;
    const ranch = await upsertRanchByName(p.ranch);

    // 2) Obtener plot (o comodín SIN LOTE)
    const plot = await getPlotOrFallback(ranch.id, p.plot);

    // 3) Calcular fechas (lunes de la semana ISO)
    // Si tu Excel trae año siembra / año final, úsalos como default si la semana no trae año
    const sow = isoWeekToMondayDate(p.sowingIsoWeek, p.yearSowing ?? yearNow);
    const har = isoWeekToMondayDate(p.harvestIsoWeek, p.yearFinal ?? p.yearSowing ?? yearNow);

    // 4) Buscar siembra existente por clave lógica
    const existing = await prisma.planting.findFirst({
      where: {
        cropId: crop.id,
        varietyId: variety?.id ?? null,
        ranchId: ranch.id,
        plotId: plot.id,
        sowingIsoWeek: sow.isoKey,
      },
    });

    if (existing) {
      await prisma.planting.update({
        where: { id: existing.id },
        data: {
          hectares: p.hectares as any,
          sowingDate: sow.monday,
          harvestDate: har.monday,
          harvestIsoWeek: har.isoKey,
          tabla: p.tabla,
          status: existing.status ?? "ACTIVE",
        },
      });
      updated++;
    } else {
      await prisma.planting.create({
        data: {
          cropId: crop.id,
          varietyId: variety?.id ?? null,
          ranchId: ranch.id,
          plotId: plot.id,
          hectares: p.hectares as any,
          sowingDate: sow.monday,
          harvestDate: har.monday,
          sowingIsoWeek: sow.isoKey,
          harvestIsoWeek: har.isoKey,
          tabla: p.tabla,
          status: "ACTIVE",
        },
      });
      created++;
    }
  }

  console.log(`✓ Seed Plantings completado. Creados: ${created}, Actualizados: ${updated}`);
  if (warnings.length) {
    console.log(`⚠️  Warnings: ${warnings.length}`);
    warnings.slice(0, 40).forEach((w) => console.log(" - " + w));
    if (warnings.length > 40) console.log(` ... (${warnings.length - 40} más)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
