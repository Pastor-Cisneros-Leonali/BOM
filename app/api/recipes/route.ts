import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const recipes = await prisma.recipe.findMany({
    where: { isActive: true },
    orderBy: [{ cropId: "asc" }, { growthWeek: "asc" }, { name: "asc" }],
    include: {
      crop: true,
      variety: true,
      items: { include: { product: true } }
    }
  });

  return NextResponse.json(recipes.map(r => ({
    id: r.id,
    name: r.name,
    classification: r.classification,
    temporalidad: r.temporalidad,
    sowingType: r.sowingType ?? null,
    growthWeek: r.growthWeek,
    crop: { id: r.cropId, name: r.crop.name },
    variety: r.variety ? { id: r.varietyId, name: r.variety.name } : null,
    items: r.items.map(it => ({
      productId: it.productId,
      product: it.product.name,
      unit: it.product.unit,
      qtyPerHectare: Number(it.qtyPerHectare),
      notes: it.notes ?? null,
    }))
  })));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, classification, cropId, varietyId, growthWeek, items, temporalidad, sowingType } = body;

  if (!name || !classification || !cropId || !growthWeek) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  // Normalización: si vienen vacíos, guardar como null
  const temporalidadNorm =
    typeof temporalidad === "string" && temporalidad.trim().length > 0
      ? temporalidad.trim()
      : null;

  const sowingTypeNorm =
    typeof sowingType === "string" && sowingType.trim().length > 0
      ? sowingType.trim()
      : null;

  const recipe = await prisma.recipe.create({
    data: {
      name,
      classification,
      temporalidad: temporalidadNorm,
      sowingType: sowingTypeNorm,
      cropId,
      varietyId: varietyId ?? null,
      growthWeek: Number(growthWeek),
      items: {
        create: (items ?? []).map((it: any) => ({
          productId: it.productId,
          qtyPerHectare: it.qtyPerHectare,
          notes: it.notes ?? null,
        }))
      }
    },
    include: { items: true }
  });

  return NextResponse.json({ id: recipe.id }, { status: 201 });
}
