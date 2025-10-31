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
    growthWeek: r.growthWeek,
    cropId: r.cropId,
    varietyId: r.varietyId,
    temporalidad: r.temporalidad ?? null,
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
  const body = await req.json();
  const { name, classification, cropId, varietyId, growthWeek, items, temporalidad } = body;

  const exists = await prisma.recipe.findUnique({ where: { id } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.recipe.update({
      where: { id },
      data: {
        name,
        classification,
        cropId,
        varietyId: varietyId ?? null,
        growthWeek: Number(growthWeek),
        temporalidad: temporalidad ?? null,
      },
    }),
    prisma.recipeItem.deleteMany({ where: { recipeId: id } }),
    prisma.recipeItem.createMany({
      data: (items ?? []).map((it: any) => ({
        recipeId: id,
        productId: it.productId,
        qtyPerHectare: it.qtyPerHectare,
        notes: it.notes ?? null,
      }))
    })
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  // Borrado duro (RecipeItem tiene onDelete: Cascade). Si prefieres lógico, usa isActive=false.
  await prisma.recipe.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}