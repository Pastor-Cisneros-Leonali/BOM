import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const r = await prisma.recipe.findUnique({
    where: { id },
    include: { crop: true, variety: true, items: { include: { product: true } } }
  });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: r.id,
    name: r.name,
    classification: r.classification,
    growthWeek: Number(r.growthWeek),
    cropId: r.cropId,
    varietyId: r.varietyId,
    temporalidad: r.temporalidad ?? null,
    sowingType: r.sowingType ?? null, // 👈 NUEVO
    items: r.items.map(it => ({
      id: it.id,
      productId: it.productId,
      product: it.product.name,
      unit: it.product.unit,
      qtyPerHectare: Number(it.qtyPerHectare),
      notes: it.notes ?? null,
    }))
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido (JSON requerido)" }, { status: 400 });
  }

  const {
    name,
    classification,
    cropId,
    varietyId,
    growthWeek,
    items,
    temporalidad,
    sowingType, // 👈 NUEVO
  } = body ?? {};

  const exists = await prisma.recipe.findUnique({ where: { id } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Normalizaciones
  const temporalidadNorm =
    typeof temporalidad === "string" && temporalidad.trim().length > 0 ? temporalidad.trim() : null;

  const sowingTypeNorm =
    typeof sowingType === "string" && sowingType.trim().length > 0 ? sowingType.trim() : null;

  // Validación mínima
  if (!name || !classification || !cropId || !growthWeek) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.recipe.update({
      where: { id },
      data: {
        name,
        classification,
        cropId,
        varietyId: varietyId ?? null,
        growthWeek: Number(growthWeek),
        temporalidad: temporalidadNorm,
        sowingType: sowingTypeNorm, 
      },
    }),
    prisma.recipeItem.deleteMany({ where: { recipeId: id } }),
    prisma.recipeItem.createMany({
      data: (items ?? []).map((it: any) => ({
        recipeId: id,
        productId: it.productId,
        qtyPerHectare: Number(it.qtyPerHectare),
        notes: it.notes ?? null,
      })),
      skipDuplicates: false,
    }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  await prisma.recipe.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
