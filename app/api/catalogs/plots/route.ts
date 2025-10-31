import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const ranchId = req.nextUrl.searchParams.get("ranchId");
  if (!ranchId) return NextResponse.json([]);
  const rows = await prisma.plot.findMany({ where: { ranchId }, orderBy: { name: "asc" } });
  return NextResponse.json(rows.map(p => ({ id: p.id, name: p.name, hectares: Number(p.hectares) })));
}