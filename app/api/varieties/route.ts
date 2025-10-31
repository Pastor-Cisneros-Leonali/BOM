import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const cropId = req.nextUrl.searchParams.get("cropId");
  const where = cropId ? { cropId } : {};
  const rows = await prisma.variety.findMany({ where, include: { crop: true }, orderBy: [{ cropId: "asc" }, { name: "asc" }] });
  return NextResponse.json(rows.map(v => ({ id: v.id, name: v.name, crop: { id: v.cropId, name: v.crop.name } })));
}

export async function POST(req: NextRequest) {
  const { name, cropId } = await req.json();
  if (!name?.trim() || !cropId) return NextResponse.json({ error: "Nombre y cultivo son obligatorios" }, { status: 400 });
  try {
    const created = await prisma.variety.create({ data: { name: name.trim(), cropId } });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Ya existe esa variedad para el cultivo" }, { status: 409 });
    return NextResponse.json({ error: "No se pudo crear" }, { status: 500 });
  }
}