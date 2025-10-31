"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export type SimpleOpt = { id: string; name: string };
export type PlotOpt = { id: string; name: string; ranchId: string };

export default function PlantingsFilters({
  crops,
  ranches,
  plots,
}: {
  crops: SimpleOpt[];
  ranches: SimpleOpt[];
  plots: PlotOpt[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [cropId, setCropId] = useState(sp.get("cropId") ?? "");
  const [ranchId, setRanchId] = useState(sp.get("ranchId") ?? "");
  const [plotId, setPlotId] = useState(sp.get("plotId") ?? "");
  const [sowFrom, setSowFrom] = useState(sp.get("sowFrom") ?? "");
  const [sowTo, setSowTo] = useState(sp.get("sowTo") ?? "");
  const [harFrom, setHarFrom] = useState(sp.get("harFrom") ?? "");
  const [harTo, setHarTo] = useState(sp.get("harTo") ?? "");
  const [tabla, setTabla] = useState(sp.get("tabla") ?? "");

  // Sincroniza cuando cambian los search params por navegación
  useEffect(() => {
    setCropId(sp.get("cropId") ?? "");
    setRanchId(sp.get("ranchId") ?? "");
    setPlotId(sp.get("plotId") ?? "");
    setSowFrom(sp.get("sowFrom") ?? "");
    setSowTo(sp.get("sowTo") ?? "");
    setHarFrom(sp.get("harFrom") ?? "");
    setHarTo(sp.get("harTo") ?? "");
    setTabla(sp.get("tabla") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.toString()]);

  // Lotes dependientes de rancho
  const plotOptions = useMemo(
    () => (ranchId ? plots.filter(p => p.ranchId === ranchId) : plots),
    [plots, ranchId]
  );

  // Si cambia rancho y el lote no pertenece, resetea plotId
  useEffect(() => {
    if (plotId) {
      const isValid = plotOptions.some(p => p.id === plotId);
      if (!isValid) setPlotId("");
    }
  }, [plotOptions, plotId]);

  const apply = () => {
    const params = new URLSearchParams();
    if (cropId) params.set("cropId", cropId);
    if (ranchId) params.set("ranchId", ranchId);
    if (plotId) params.set("plotId", plotId);

    if (sowFrom) params.set("sowFrom", sowFrom);
    if (sowTo) params.set("sowTo", sowTo);
    if (harFrom) params.set("harFrom", harFrom);
    if (harTo) params.set("harTo", harTo);

    if (tabla.trim()) params.set("tabla", tabla.trim());

    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const clear = () => {
    setCropId("");
    setRanchId("");
    setPlotId("");
    setSowFrom("");
    setSowTo("");
    setHarFrom("");
    setHarTo("");
    setTabla("");
    router.push(pathname);
  };

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="grid gap-3 md:grid-cols-6">
        {/* Materia prima */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Materia prima</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={cropId}
            onChange={e => setCropId(e.target.value)}
          >
            <option value="">Todas</option>
            {crops.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Rancho */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Rancho</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={ranchId}
            onChange={e => setRanchId(e.target.value)}
          >
            <option value="">Todos</option>
            {ranches.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Lote (depende de rancho) */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Lote</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={plotId}
            onChange={e => setPlotId(e.target.value)}
          >
            <option value="">Todos</option>
            {plotOptions.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Fechas siembra */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Siembra desde</label>
          <input type="date" className="w-full rounded border px-3 py-2" value={sowFrom} onChange={e => setSowFrom(e.target.value)} />
        </div>
        {/* <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Siembra hasta</label>
          <input type="date" className="w-full rounded border px-3 py-2" value={sowTo} onChange={e => setSowTo(e.target.value)} />
        </div> */}

        {/* Fechas cosecha */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cosecha desde</label>
          <input type="date" className="w-full rounded border px-3 py-2" value={harFrom} onChange={e => setHarFrom(e.target.value)} />
        </div>
        {/* <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cosecha hasta</label>
          <input type="date" className="w-full rounded border px-3 py-2" value={harTo} onChange={e => setHarTo(e.target.value)} />
        </div> */}

        {/* NUEVO: Búsqueda por "tabla" */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Tabla (búsqueda)</label>
          <input
            type="search"
            className="w-full rounded border px-3 py-2"
            placeholder="Ej. Tabla 1, Lote A..."
            value={tabla}
            onChange={e => setTabla(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button onClick={apply} className="rounded bg-black px-4 py-2 text-white hover:opacity-90">
          Aplicar filtros
        </button>
        <button onClick={clear} className="rounded border px-4 py-2 hover:bg-gray-50">
          Limpiar
        </button>
      </div>
    </div>
  );
}
