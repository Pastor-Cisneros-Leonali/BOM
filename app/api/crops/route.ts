import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const crops = await prisma.crop.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(crops.map(c => ({ id: c.id, name: c.name })));
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }
  try {
    const created = await prisma.crop.create({ data: { name: name.trim() } });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un cultivo con ese nombre" }, { status: 409 });
    }
    return NextResponse.json({ error: "No se pudo crear" }, { status: 500 });
  }
}