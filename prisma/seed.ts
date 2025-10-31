import { PrismaClient } from "@prisma/client";
import * as path from "node:path";
import * as fs from "node:fs";
import XLSX from "xlsx";

const prisma = new PrismaClient();

// ===== Helpers de normalización / warnings =====
const warnings: string[] = [];
function warn(msg: string) {
  warnings.push(msg);
  console.warn(msg);
}

const stripDiacritics = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "");

const normKey = (s: string) => stripDiacritics(String(s ?? "")).trim().toUpperCase();

/** Canonicaliza headers: mapea alias -> clave esperada */
function canonicalizeRow<T extends Record<string, any>>(
  row: T,
  dictionary: Record<string, string>
) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = String(k).trim().toLowerCase();
    const keyNoAcc = stripDiacritics(key);
    const canon =
      dictionary[key] ??
      dictionary[keyNoAcc] ??
      key; // si no hay mapping, deja el original (lower)
    out[canon] = v;
  }
  return out as T;
}

/** Acepta 1, "1", "1,0" */
function toNumber(n: any, fallback = NaN) {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (n == null) return fallback;
  const s = String(n).trim().replace(",", ".");
  const x = Number(s);
  return Number.isFinite(x) ? x : fallback;
}

/** Acepta 1, "1", "S1", "Semana 1", "1-2", "1 a 2", "1/2"; si 0 o NaN -> 1 con warning */
function parseGrowthWeek(raw: any, rowIdxForLogs?: number): number {
  if (raw == null) {
    warn(`Fila ${rowIdxForLogs ?? "?"} 'Recetas': growthWeek vacío → usando 1`);
    return 1;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw <= 0) {
      warn(`Fila ${rowIdxForLogs ?? "?"} 'Recetas': growthWeek=${raw} → usando 1`);
      return 1;
    }
    return Math.floor(raw);
  }
  const s = String(raw);
  const cleaned = s
    .replace(",", ".")
    .replace(/semana/gi, "")
    .replace(/sem\.?/gi, "")
    .replace(/s/gi, "")
    .trim();

  const m = cleaned.match(/\d+/);
  if (m) {
    const n = Number(m[0]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  warn(`Fila ${rowIdxForLogs ?? "?"} 'Recetas': growthWeek "${s}" inválido → usando 1`);
  return 1;
}

/** Normaliza clasificación a enum Prisma */
function parseClassification(raw: any): "FERTILIZANTE" | "AGROQUIMICO" {
  const s = normKey(raw).replace(/[^A-Z]/g, ""); // quita espacios/guiones
  if (s.startsWith("FERTILIZ")) return "FERTILIZANTE";
  if (s.startsWith("AGROQUIM")) return "AGROQUIMICO";
  throw new Error(
    `classification inválida ("${raw}"). Usa FERTILIZANTE o AGROQUIMICO (se aceptan acentos/plurales).`
  );
}

// ===== Aliases de headers =====
const RECETAS_KEYS: Record<string, string> = {
  // directos
  name: "name",
  crop: "crop",
  variety: "variety",
  growthweek: "growthWeek",
  classification: "classification",
  temporalidad: "temporalidad",
  sowingtype: "sowingType",
  // españoles/variantes
  nombre: "name",
  receta: "name",
  paquete: "name",
  cultivo: "crop",
  variedad: "variety",
  semana: "growthWeek",
  "semana aplicacion": "growthWeek",
  "semana_de_aplicacion": "growthWeek",
  "semana de crecimiento": "growthWeek",
  clasificacion: "classification",
  "clasificación": "classification",
  tipo: "classification",
  "tipo de siembra": "sowingType",
  "tipo_de_siembra": "sowingType",
  tiposiembra: "sowingType",
};

const ITEMS_KEYS: Record<string, string> = {
  recipename: "recipeName",
  "nombre de receta": "recipeName",
  receta: "recipeName",
  paquete: "recipeName",
  productname: "productName",
  producto: "productName",
  qtyperhectare: "qtyPerHectare",
  dosis_ha: "qtyPerHectare",
  "cantidad/ha": "qtyPerHectare",
};

// ===== Upserts =====
async function upsertCropByName(name: string) {
  const clean = name.trim();
  const ex = await prisma.crop.findFirst({ where: { name: clean } });
  return ex ?? prisma.crop.create({ data: { name: clean } });
}

async function upsertVarietyByName(cropId: string, name: string) {
  const clean = name.trim();
  const ex = await prisma.variety.findFirst({ where: { cropId, name: clean } });
  return ex ?? prisma.variety.create({ data: { cropId, name: clean } });
}

async function upsertProductByName(name: string) {
  const clean = name.trim();
  const ex = await prisma.product.findFirst({ where: { name: clean } });
  // unit = "" para que la edites manualmente después
  return ex ?? prisma.product.create({ data: { name: clean, unit: "" } });
}

// ===== MAIN =====
async function main() {
  const xlsxPath = path.join(process.cwd(), "prisma", "Recetas.xlsx");
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`No se encontró prisma/Recetas.xlsx en ${xlsxPath}`);
  }

  const wb = XLSX.readFile(xlsxPath, { cellDates: false });

  // ---- Recetas ----
  const wsRecetas = wb.Sheets["Recetas"];
  if (!wsRecetas) throw new Error("La hoja 'Recetas' no existe.");
  const rawRecetas = XLSX.utils.sheet_to_json<Record<string, any>>(wsRecetas, { defval: "" });

  const recetas = rawRecetas.map((r0, idx) => {
    const r = canonicalizeRow(r0, RECETAS_KEYS);

    const name = String(r.name ?? "").trim();
    const crop = String(r.crop ?? "").trim();
    if (!name || !crop) throw new Error(`Fila ${idx + 2} 'Recetas': faltan 'name' o 'crop'`);

    const variety = String(r.variety ?? "").trim() || null;
    const growthWeek = parseGrowthWeek(r.growthWeek, idx + 2);
    const classification = parseClassification(r.classification);
    const temporalidad = String(r.temporalidad ?? "").trim() || null;
    const sowingType = String(r.sowingType ?? "").trim() || null;

    return { name, crop, variety, growthWeek, classification, temporalidad, sowingType };
  });

  // ---- Items (agrupados por receta y producto) ----
  const wsItems = wb.Sheets["Items"];
  if (!wsItems) throw new Error("La hoja 'Items' no existe.");
  const rawItems = XLSX.utils.sheet_to_json<Record<string, any>>(wsItems, { defval: "" });

  // itemsGrouped: Map<recipeNameOriginal, Map<productKey, { productName, qtyPerHectare }>>
  const itemsGrouped = new Map<
    string,
    Map<string, { productName: string; qtyPerHectare: number }>
  >();

  rawItems.forEach((i0, idx) => {
    const rowNumber = idx + 2;
    const i = canonicalizeRow(i0, ITEMS_KEYS);

    const recipeNameRaw = String(i.recipeName ?? "").trim();
    const productNameRaw = String(i.productName ?? "").trim();
    const qtyRaw = toNumber(i.qtyPerHectare);

    if (!recipeNameRaw || recipeNameRaw.length < 2) {
      warn(`Items fila ${rowNumber}: recipeName corto/vacío ("${recipeNameRaw}") → omitido`);
      return;
    }
    if (!productNameRaw) {
      warn(`Items fila ${rowNumber}: productName vacío → omitido`);
      return;
    }
    if (!Number.isFinite(qtyRaw) || qtyRaw <= 0) {
      warn(`Items fila ${rowNumber}: qtyPerHectare "${i.qtyPerHectare}" inválido → omitido`);
      return;
    }

    const recName = recipeNameRaw; // mantenemos el original para matching exacto con Recetas.name
    const prodKey = normKey(productNameRaw);

    if (!itemsGrouped.has(recName)) itemsGrouped.set(recName, new Map());
    const byProd = itemsGrouped.get(recName)!;

    if (byProd.has(prodKey)) {
      const prev = byProd.get(prodKey)!;
      byProd.set(prodKey, {
        productName: prev.productName,
        qtyPerHectare: prev.qtyPerHectare + qtyRaw,
      });
      warn(
        `Items: duplicado para receta "${recName}" y producto "${productNameRaw}" → sumado (${prev.qtyPerHectare} + ${qtyRaw})`
      );
    } else {
      byProd.set(prodKey, { productName: productNameRaw, qtyPerHectare: qtyRaw });
    }
  });

  // Validar referencias de Items hacia Recetas
  const nombresRecetas = new Set(recetas.map((r) => r.name.trim()));
  for (const recName of Array.from(itemsGrouped.keys())) {
    if (!nombresRecetas.has(recName.trim())) {
      const count = itemsGrouped.get(recName)!.size;
      warn(
        `Items: la receta "${recName}" no existe en la hoja Recetas → ${count} ítem(s) omitido(s)`
      );
      itemsGrouped.delete(recName);
    }
  }

  // ---- Procesar recetas ----
  for (const r of recetas) {
    // 1) Crop y Variety
    const crop = await upsertCropByName(r.crop);
    let varietyId: string | null = null;
    if (r.variety) {
      const v = await upsertVarietyByName(crop.id, r.variety);
      varietyId = v.id;
    }

    // 2) Buscar receta existente por clave lógica
    const exists = await prisma.recipe.findFirst({
      where: {
        name: r.name,
        cropId: crop.id,
        varietyId: varietyId,
        growthWeek: r.growthWeek,
        version: 1,
      },
    });

    let recipeId: string;
    if (exists) {
      const upd = await prisma.recipe.update({
        where: { id: exists.id },
        data: {
          classification: r.classification,
          temporalidad: r.temporalidad,
          sowingType: r.sowingType,
          isActive: true,
        },
      });
      recipeId = upd.id;

      // Limpia ítems previos para asegurar no duplicar
      await prisma.recipeItem.deleteMany({ where: { recipeId } });
    } else {
      const created = await prisma.recipe.create({
        data: {
          name: r.name,
          classification: r.classification,
          cropId: crop.id,
          varietyId,
          growthWeek: r.growthWeek,
          temporalidad: r.temporalidad,
          sowingType: r.sowingType,
          version: 1,
          isActive: true,
        },
      });
      recipeId = created.id;
    }

    // 3) Crear items agrupados (si existen)
    const byProd = itemsGrouped.get(r.name) ?? new Map();
    if (byProd.size === 0) {
      warn(`Recetas: "${r.name}" no tiene ítems válidos en la hoja Items → se crea sin ítems`);
      continue;
    }

    // Resolver productIds en paralelo
    const uniqueItems = Array.from(byProd.values());
    const products = await Promise.all(
      uniqueItems.map((ui) => upsertProductByName(ui.productName))
    );

    // Payload único por (recipeId, productId)
    const data = products.map((p, i) => ({
      recipeId,
      productId: p.id,
      qtyPerHectare: uniqueItems[i].qtyPerHectare,
    }));

    if (data.length > 0) {
      // Blindaje extra contra duplicados residuales
      await prisma.recipeItem.createMany({
        data,
        skipDuplicates: true,
      });
    }
  }

  console.log(`✓ Seed completado. Recetas procesadas: ${recetas.length}`);
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
  .finally(async () => {
    await prisma.$disconnect();
  });
