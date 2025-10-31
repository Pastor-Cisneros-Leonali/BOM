import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const crop = await prisma.crop.findUnique({ where: { id: params.id } });
  if (!crop) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: crop.id, name: crop.name });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }
  try {
    await prisma.crop.update({ where: { id: params.id }, data: { name: name.trim() } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un cultivo con ese nombre" }, { status: 409 });
    }
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  // Validación: evitar borrar si tiene variedades/plantings/recipes vinculados
  const links = await prisma.crop.findUnique({
    where: { id: params.id },
    include: {
      varieties: { select: { id: true }, take: 1 },
      plantings: { select: { id: true }, take: 1 },
      recipes: { select: { id: true }, take: 1 },
    },
  });
  if (!links) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (links.varieties.length || links.plantings.length || links.recipes.length) {
    return NextResponse.json({
      error: "No se puede eliminar: tiene dependencias (variedades/siembras/recetas)",
    }, { status: 409 });
  }
  await prisma.crop.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}