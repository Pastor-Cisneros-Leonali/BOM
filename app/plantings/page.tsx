// app/plantings/page.tsx
import Link from "next/link";
import PlantingsFilters, { PlotOpt, SimpleOpt } from "@/components/PlatingsFilters";
import { prisma } from "@/lib/prisma";

async function getCatalogs() {
  const [crops, ranches, plots] = await Promise.all([
    prisma.crop.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.ranch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.plot.findMany({ select: { id: true, name: true, ranchId: true }, orderBy: { name: "asc" } }),
  ]);

  return {
    crops: crops as SimpleOpt[],
    ranches: ranches as SimpleOpt[],
    plots: plots as PlotOpt[],
  };
}

async function getPlantings(searchParams: Record<string, string | string[] | undefined>) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const params = new URLSearchParams();

  const pass = ["cropId", "ranchId", "plotId", "sowFrom", "sowTo", "harFrom", "harTo", "tabla"];
  for (const key of pass) {
    const v = searchParams[key];
    if (Array.isArray(v)) v.forEach(x => params.append(key, x));
    else if (v) params.set(key, v);
  }

  const url = `${base}/api/plantings${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar la lista de siembras");
  return res.json();
}

export default async function PlantingsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const [{ crops, ranches, plots }, data] = await Promise.all([
    getCatalogs(),
    getPlantings(searchParams),
  ]);

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Siembras</h1>
        <Link href="/plantings/new" className="rounded bg-black px-4 py-2 text-white hover:opacity-90">
          + Nueva siembra
        </Link>
      </div>

      {/* Barra de filtros con selects + tabla */}
      <PlantingsFilters crops={crops} ranches={ranches} plots={plots} />

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Materia Prima</th>
              <th className="px-3 py-2">Variedad</th>
              <th className="px-3 py-2">Rancho/Lote</th>
              <th className="px-3 py-2">Hectáreas</th>
              <th className="px-3 py-2">Siembra</th>
              <th className="px-3 py-2">Cosecha</th>
              <th className="px-3 py-2">Tabla</th> {/* NUEVO */}
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{p.crop?.name}</td>
                <td className="px-3 py-2">{p.variety?.name ?? "—"}</td>
                <td className="px-3 py-2">{p.ranch?.name} / {p.plot?.name}</td>
                <td className="px-3 py-2">{Number(p.hectares).toFixed(2)}</td>
                <td className="px-3 py-2">{new Date(p.sowingDate).toLocaleDateString()}</td>
                <td className="px-3 py-2">{new Date(p.harvestDate).toLocaleDateString()}</td>
                <td className="px-3 py-2">{p.tabla ?? "—"}</td> {/* NUEVO */}
                <td className="px-3 py-2">{p.status}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/plantings/${p.id}`} className="text-blue-600 hover:underline">Editar</Link>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={9}>
                  No se encontraron siembras con los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
