import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.ranch.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(rows.map(r => ({ id: r.id, name: r.name })));
}