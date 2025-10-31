import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const crops = await prisma.crop.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(crops.map(c => ({ id: c.id, name: c.name })));
}