import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const v = await prisma.variety.findUnique({ where: { id: params.id } });
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: v.id, name: v.name, cropId: v.cropId });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { name, cropId } = await req.json();
  if (!name?.trim() || !cropId) return NextResponse.json({ error: "Nombre y cultivo son obligatorios" }, { status: 400 });
  try {
    await prisma.variety.update({ where: { id: params.id }, data: { name: name.trim(), cropId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Ya existe esa variedad para el cultivo" }, { status: 409 });
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  // Evitar borrar si está referenciada por plantings o recipes
  const links = await prisma.variety.findUnique({ where: { id: params.id }, include: { plantings: { take: 1 }, recipes: { take: 1 } } });
  if (!links) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (links.plantings.length || links.recipes.length) {
    return NextResponse.json({ error: "No se puede eliminar: tiene dependencias (siembras/recetas)" }, { status: 409 });
  }
  await prisma.variety.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}