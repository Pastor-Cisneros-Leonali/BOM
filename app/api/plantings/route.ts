import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIsoWeekKey } from "@/lib/iso";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;

  // IDs desde selects
  const cropId = url.searchParams.get("cropId");
  const ranchId = url.searchParams.get("ranchId");
  const plotId  = url.searchParams.get("plotId");

  // Rango de fechas
  const sowFrom = url.searchParams.get("sowFrom"); // YYYY-MM-DD
  const sowTo   = url.searchParams.get("sowTo");
  const harFrom = url.searchParams.get("harFrom");
  const harTo   = url.searchParams.get("harTo");

  // NUEVO: búsqueda por campo "tabla"
  const tablaQ  = url.searchParams.get("tabla"); // string

  const where: any = {};

  if (cropId) where.cropId = cropId;
  if (ranchId) where.ranchId = ranchId;
  if (plotId)  where.plotId  = plotId;

  if (sowFrom || sowTo) {
    where.sowingDate = {};
    if (sowFrom) where.sowingDate.gte = new Date(`${sowFrom}T00:00:00`);
    if (sowTo)   where.sowingDate.lte = new Date(`${sowTo}T23:59:59.999`);
  }
  if (harFrom || harTo) {
    where.harvestDate = {};
    if (harFrom) where.harvestDate.gte = new Date(`${harFrom}T00:00:00`);
    if (harTo)   where.harvestDate.lte = new Date(`${harTo}T23:59:59.999`);
  }

  // NUEVO: filtro por "tabla"
  if (tablaQ) {
    where.tabla = { contains: tablaQ, mode: "insensitive" };
  }

  const rows = await prisma.planting.findMany({
    where,
    orderBy: { sowingDate: "desc" },
    include: { crop: true, variety: true, ranch: true, plot: true },
  });

  return NextResponse.json(rows.map(p => ({
    id: p.id,
    crop: { id: p.cropId, name: p.crop.name },
    variety: p.variety ? { id: p.varietyId, name: p.variety.name } : null,
    ranch: { id: p.ranchId, name: p.ranch.name },
    plot: { id: p.plotId, name: p.plot.name },
    hectares: Number(p.hectares),
    sowingDate: p.sowingDate,
    harvestDate: p.harvestDate,
    sowingIsoWeek: p.sowingIsoWeek,
    harvestIsoWeek: p.harvestIsoWeek,
    status: p.status,
    tabla: p.tabla ?? null, // <- expone "tabla" al frontend
  })));
}

export async function POST(req: NextRequest) {
  const { cropId, varietyId, ranchId, plotId, hectares, sowingDate, harvestDate, tabla } = await req.json();
  if (!cropId || !ranchId || !plotId || !hectares || !sowingDate || !harvestDate)
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });

  const sow = new Date(sowingDate);
  const har = new Date(harvestDate);
  if (!(sow <= har)) return NextResponse.json({ error: "La fecha de siembra debe ser <= cosecha" }, { status: 400 });
  if (Number(hectares) <= 0) return NextResponse.json({ error: "Hectáreas debe ser > 0" }, { status: 400 });

  const created = await prisma.planting.create({
    data: {
      cropId,
      varietyId: varietyId || null,
      ranchId,
      plotId,
      hectares,
      sowingDate: sow,
      harvestDate: har,
      sowingIsoWeek: getIsoWeekKey(sow),
      harvestIsoWeek: getIsoWeekKey(har),
      status: "ACTIVE",
      tabla: tabla || null, // <- permite guardar "tabla" si lo envías
    }
  });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
