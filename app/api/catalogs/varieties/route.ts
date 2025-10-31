import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const cropId = req.nextUrl.searchParams.get("cropId");
  if (!cropId) return NextResponse.json([], { status: 200 });
  const varieties = await prisma.variety.findMany({ where: { cropId }, orderBy: { name: "asc" } });
  return NextResponse.json(varieties.map(v => ({ id: v.id, name: v.name })));
}