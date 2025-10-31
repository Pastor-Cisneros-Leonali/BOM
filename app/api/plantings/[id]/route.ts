import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIsoWeekKey } from "@/lib/iso";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const p = await prisma.planting.findUnique({ where: { id: params.id } });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    id: p.id,
    cropId: p.cropId,
    varietyId: p.varietyId,
    ranchId: p.ranchId,
    plotId: p.plotId,
    hectares: Number(p.hectares),
    sowingDate: p.sowingDate,
    harvestDate: p.harvestDate,
    status: p.status,
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { cropId, varietyId, ranchId, plotId, hectares, sowingDate, harvestDate, status } = await req.json();
  if (!cropId || !ranchId || !plotId || !hectares || !sowingDate || !harvestDate)
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });

  const sow = new Date(sowingDate);
  const har = new Date(harvestDate);
  if (!(sow <= har)) return NextResponse.json({ error: "La fecha de siembra debe ser <= cosecha" }, { status: 400 });
  if (Number(hectares) <= 0) return NextResponse.json({ error: "Hectáreas debe ser > 0" }, { status: 400 });

  await prisma.planting.update({
    where: { id: params.id },
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
      status: status ?? "ACTIVE",
    }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  // Si a futuro referenciamos órdenes/lecturas, aquí validaríamos dependencias
  await prisma.planting.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}