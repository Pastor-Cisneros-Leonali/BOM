"use client";
import { useEffect, useMemo, useState } from "react";
import { ZONE_OPTIONS, ZONE_RANCHES } from "@/lib/zones";

type Opt = { id: string; name: string };
type Source = {
  recipeId: string; recipeName: string; temporalidad: string;
  growthWeek: number; classification: "AGROQUIMICO"|"FERTILIZANTE";
  totalFromThisRecipe: number; occurrences: number;
};
type TotRow = {
  productId: string; name: string; unit: string;
  classification: "AGROQUIMICO"|"FERTILIZANTE";
  total: number;
  cells: Record<string, number>;
  sources: Source[];
};

function toCSV(rows: TotRow[], columns: string[]) {
  const header = ["Producto","Clasificación","Unidad", ...columns, "TOTAL"];
  const lines = rows.map(r => {
    const cellVals = columns.map(c => (r.cells?.[c] ?? 0).toFixed(3));
    return [r.name, r.classification, r.unit ?? "", ...cellVals, r.total.toFixed(3)]
      .map(v => `"${String(v).replace(/"/g,'""')}"`).join(",");
  });
  return [header.join(","), ...lines].join("\n");
}
function toCSVWithSources(rows: TotRow[]) {
  const header = ["Producto","Clasificación","Unidad","Total Producto","Receta","Temporalidad","SemanaCrec.","Aporte Receta","Ocurrencias"];
  const lines: string[] = [];
  for (const r of rows) {
    if (!r.sources?.length) {
      lines.push([r.name,r.classification,r.unit ?? "",r.total,"","","","",""]
        .map(v => `"${String(v).replace(/"/g,'""')}"`).join(","));
    } else {
      for (const s of r.sources) {
        lines.push([r.name,r.classification,r.unit ?? "",r.total,s.recipeName,(s.temporalidad||"Anual"),`S${s.growthWeek}`,s.totalFromThisRecipe,s.occurrences]
          .map(v => `"${String(v).replace(/"/g,'""')}"`).join(","));
      }
    }
  }
  return [header.join(","), ...lines].join("\n");
}



/** ==== UI helpers ==== */
function heatClass(val: number, rowMax: number) {
  if (!rowMax || val <= 0) return "";
  const pct = val / rowMax;
  if (pct >= 0.90) return "bg-indigo-700 text-white";
  if (pct >= 0.70) return "bg-indigo-600 text-white";
  if (pct >= 0.50) return "bg-indigo-500 text-white";
  if (pct >= 0.35) return "bg-indigo-400 text-white";
  if (pct >= 0.20) return "bg-indigo-300";
  if (pct >= 0.10) return "bg-indigo-200";
  return "bg-indigo-100";
}

export default function WarehousePage() {
  const today = new Date();
  const [years] = useState<number[]>(() => {
    const y = today.getFullYear();
    return [y - 1, y, y + 1, y + 2];
  });
  const [year, setYear] = useState<number>(today.getFullYear());
  const [week, setWeek] = useState<number>(1);
  const [scope, setScope] = useState<"week"|"year">("year");

  const [weekStart, setWeekStart] = useState<number>(1);
  const [weekEnd, setWeekEnd] = useState<number>(53);

  const [ranches, setRanches] = useState<Opt[]>([]);
  const [crops, setCrops] = useState<Opt[]>([]);
  const [zone, setZone] = useState<""|"A"|"B">("");
  const [ranchId, setRanchId] = useState<string>("");
  const [cropId, setCropId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<TotRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [countPlantings, setCountPlantings] = useState(0);

  // Modal (recetas)
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<TotRow | null>(null);
  function openModal(row: TotRow) { setSelected(row); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setSelected(null); }
  useEffect(() => {
    function onKey(e: KeyboardEvent){ if (e.key === "Escape") closeModal(); }
    if (modalOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);
  function productSourcesToCSV(row: TotRow) {
    const header = ["Receta","Temporalidad","SemanaCrec.","Ocurrencias","Aporte","% del producto"];
    const lines = (row.sources ?? []).map(s => {
      const pct = row.total ? (s.totalFromThisRecipe / row.total) * 100 : 0;
      const arr = [s.recipeName, s.temporalidad || "Anual", `S${s.growthWeek}`, String(s.occurrences), s.totalFromThisRecipe.toFixed(3), `${pct.toFixed(2)}%`];
      return arr.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",");
    });
    return [header.join(","), ...lines].join("\n");
  }

  useEffect(() => {
    (async () => {
      const [rRes, cRes] = await Promise.all([fetch("/api/catalogs/ranches"), fetch("/api/catalogs/crops")]);
      setRanches(await rRes.json());
      setCrops(await cRes.json());
    })();
  }, []);

  const ranchesToShow = useMemo(() => {
    if (!zone) return ranches;
    const ids = new Set(ZONE_RANCHES[zone] ?? []);
    return ranches.filter(r => ids.has(r.id));
  }, [zone, ranches]);

  const fetchData = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("year", String(year));
    params.set("week", String(week));
    params.set("scope", scope);
    if (scope === "year") {
      if (weekStart) params.set("weekStart", String(weekStart));
      if (weekEnd) params.set("weekEnd", String(Math.max(weekStart, weekEnd)));
    }
    if (zone) params.set("zone", zone);
    if (ranchId) params.set("ranchId", ranchId);
    if (cropId) params.set("cropId", cropId);

    const res = await fetch(`/api/warehouse/weekly-supply?${params.toString()}`, { cache: "no-store" });
    const json = await res.json();
    setRows(json.totals ?? []);
    setColumns(json.columns ?? []);
    setCountPlantings(json.meta?.countPlantings ?? 0);
    setLoading(false);
  };
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const csvHref = useMemo(() => {
    const blob = new Blob([toCSV(rows, columns)], { type: "text/csv;charset=utf-8;" });
    return URL.createObjectURL(blob);
  }, [rows, columns]);
  const csvSourcesHref = useMemo(() => {
    const blob = new Blob([toCSVWithSources(rows)], { type: "text/csv;charset=utf-8;" });
    return URL.createObjectURL(blob);
  }, [rows]);

  const totalLines = useMemo(() => rows.reduce((acc, r) => acc + r.total, 0), [rows]);

  // ==== UI extra: heatmap y hover de columna ====
  const rowMaxCache = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      let max = 0;
      for (const c of columns) max = Math.max(max, r.cells?.[c] ?? 0);
      m[r.productId] = max;
    }
    return m;
  }, [rows, columns]);

  const [hoverCol, setHoverCol] = useState<number | null>(null);

  // === Tamaños fijos para scroll ===
  const TABLE_HEIGHT_PX = 0; // si quieres exacto en px, pon un número (>0) y cambia el style abajo
  const TABLE_HEIGHT_CLASS = "h-[70vh]"; // o usa clase de Tailwind; puedes cambiar a h-[60vh], etc.

  const FIRST_COL_PX = 260;  // ancho fijo primera columna (Producto)
  const ISO_COL_PX   = 110;  // ancho fijo por columna ISO
  const TOTAL_COL_PX = 120;  // ancho fijo columna TOTAL

  const tableWidth = useMemo(() => {
    return FIRST_COL_PX + TOTAL_COL_PX + (columns.length * ISO_COL_PX);
  }, [columns]);

  // Máximo por columna (para normalizar intensidad)
  const colMax = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of columns) {
      let max = 0;
      for (const r of rows) max = Math.max(max, r.cells?.[c] ?? 0);
      m[c] = max;
    }
    return m;
  }, [rows, columns]);

  // Estilo de celda por columna (degradado por intensidad)
  function cellStyleByColumn(val: number, max: number) {
    if (!max || val <= 0) return {};
    const t = Math.max(0, Math.min(1, val / max));     // 0..1
    const alpha = 0.15 + 0.75 * t;                     // 0.15..0.90
    // Azul Tailwind 600 aprox: rgb(37, 99, 235)
    const bg = `rgba(37, 99, 235, ${alpha})`;
    const color = t >= 0.6 ? "#ffffff" : undefined;    // texto blanco si es muy intenso
    return { backgroundColor: bg, color };
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-green-700 via-green-700 to-green-200">
      {/* Topbar */}
      <header className="mx-auto max-w-[120rem] px-6 pt-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white drop-shadow-sm">BOM – Requerimientos por Semana ISO</h1>
            {/* <p className="text-sm text-white/80">Última actualización: {today.toLocaleDateString()} {today.toLocaleTimeString()}</p> */}
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-black/20 p-1 ring-1 ring-white/10 backdrop-blur">
              <button onClick={() => setScope("year")} className={`px-4 py-2 text-sm rounded-full ${scope==="year"?"bg-white text-black":"text-white/90 hover:bg-white/10"}`}>Año</button>
              <button onClick={() => setScope("week")} className={`px-4 py-2 text-sm rounded-full ${scope==="week"?"bg-white text-black":"text-white/90 hover:bg-white/10"}`}>Semana</button>
            </div>
            <div className="rounded-lg bg-black/20 p-1 ring-1 ring-white/10 backdrop-blur">
              {years.map((y)=>(
                <button key={y} onClick={()=>setYear(y)} className={`px-4 py-2 text-sm rounded-md ${y===year?"bg-white text-black shadow-sm":"text-white/90 hover:bg-white/10"}`}>{y}</button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto mt-6 grid max-w-[120rem] grid-cols-1 gap-6 px-6 pb-10 lg:grid-cols-[310px_1fr]">
        {/* Filtros */}
        <aside className="space-y-5">
          <section className="rounded-2xl bg-white/15 p-4 text-white ring-1 ring-white/20 backdrop-blur">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/90">Semana</h3>
            {scope === "week" ? (
              <div className="mt-3 space-y-2">
                <input type="number" min={1} max={53} value={week}
                  onChange={(e)=>setWeek(Math.max(1,Math.min(53, Number(e.target.value)||1)))}
                  className="w-full rounded-lg border-0 bg-white/90 px-3 py-2 text-black shadow-sm"/>
                <p className="text-xs text-white/80">ISO 1–53</p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-white/70">Inicio</label>
                    <input type="number" min={1} max={53} value={weekStart}
                      onChange={(e)=>setWeekStart(Math.max(1,Math.min(53, Number(e.target.value)||1)))}
                      className="w-full rounded-lg border-0 bg-white/90 px-3 py-2 text-black shadow-sm"/>
                  </div>
                  <div>
                    <label className="text-[11px] text-white/70">Fin</label>
                    <input type="number" min={1} max={53} value={weekEnd}
                      onChange={(e)=>setWeekEnd(Math.max(weekStart,Math.min(53, Number(e.target.value)||weekStart)))}
                      className="w-full rounded-lg border-0 bg-white/90 px-3 py-2 text-black shadow-sm"/>
                  </div>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-white/30 ring-1 ring-white/40">
                  <div className="h-2 rounded-full bg-white/90" style={{width: `${((weekEnd-weekStart+1)/53)*100}%`, marginLeft: `${((weekStart-1)/53)*100}%`}}/>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white/15 p-4 text-white ring-1 ring-white/20 backdrop-blur">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/90">Ubicación</h3>
            <div className="mt-3 space-y-2">
              <label className="text-[11px] text-white/70">Zona</label>
              <select className="w-full rounded-lg border-0 bg-white/90 px-3 py-2 text-black shadow-sm"
                value={zone} onChange={(e)=>{ setZone(e.target.value as ""|"A"|"B"); setRanchId(""); }}>
                {ZONE_OPTIONS.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
              <label className="text-[11px] text-white/70">Rancho</label>
              <select className="w-full rounded-lg border-0 bg-white/90 px-3 py-2 text-black shadow-sm"
                value={ranchId} onChange={(e)=>setRanchId(e.target.value)}>
                <option value="">Todos</option>
                {ranchesToShow.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </section>

          <section className="rounded-2xl bg-white/15 p-4 text-white ring-1 ring-white/20 backdrop-blur">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/90">Materia prima / Cultivo</h3>
            <select className="mt-3 w-full rounded-lg border-0 bg-white/90 px-3 py-2 text-black shadow-sm"
              value={cropId} onChange={(e)=>setCropId(e.target.value)}>
              <option value="">Todos</option>
              {crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </section>

          <section className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20 backdrop-blur">
            <div className="flex flex-col gap-2">
              <button onClick={fetchData} className="rounded-xl bg-white px-4 py-2 font-medium text-black shadow hover:opacity-90">
                {loading ? "Calculando…" : "Aplicar filtros"}
              </button>
              <a href={csvHref} download={`pivot_${scope}_${year}.csv`}
                 className="rounded-xl bg-white/90 px-4 py-2 text-center text-sm text-black shadow hover:opacity-90">
                Exportar CSV (tabla)
              </a>
              <a href={csvSourcesHref} download={`pivot_recetas_${scope}_${year}.csv`}
                 className="rounded-xl bg-white/90 px-4 py-2 text-center text-sm text-black shadow hover:opacity-90">
                Exportar CSV (recetas)
              </a>
              <p className="mt-1 text-center text-xs text-white/80">
                Siembras vivas: <span className="font-semibold">{countPlantings}</span>
              </p>
            </div>
          </section>
        </aside>

        {/* Tabla */}
        <section className="rounded-2xl bg-white/95 p-3 shadow-xl ring-1 ring-black/5 backdrop-blur">
        {/* Tabla Pivot: productos x semanas con tamaño fijo + scroll */}
        <div
          className={`relative rounded-xl border bg-white shadow-sm ${TABLE_HEIGHT_CLASS}`}
          style={TABLE_HEIGHT_PX ? { height: TABLE_HEIGHT_PX } : undefined}
        >
          <div className="absolute inset-0 overflow-auto">
            <table className="text-sm" style={{ minWidth: tableWidth }}>
              <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600">
                <tr>
                  {/* Producto */}
                  <th
                    className="px-3 py-2 sticky left-0 z-10 bg-gray-50 text-left"
                    style={{ minWidth: FIRST_COL_PX, width: FIRST_COL_PX }}
                  >
                    Producto
                  </th>

                  {/* Semanas ISO */}
                  {columns.map((col, idx) => {
                    const weekNumber = col.split("-W")[1] ?? col;
                    return (
                      <th
                        key={col}
                        className="px-3 py-2 text-right whitespace-nowrap"
                        style={{ minWidth: ISO_COL_PX, width: ISO_COL_PX }}
                      >
                        {weekNumber}
                      </th>
                    );
                  })}

                  {/* TOTAL */}
                  <th
                    className="px-3 py-2 text-right"
                    style={{ minWidth: TOTAL_COL_PX, width: TOTAL_COL_PX }}
                  >
                    TOTAL
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => (
                  <tr key={r.productId} className="border-t hover:bg-gray-50/60">
                    {/* Producto (sticky) */}
                    <td
                      className="px-3 py-2 sticky left-0 z-10 bg-white"
                      style={{ minWidth: FIRST_COL_PX, width: FIRST_COL_PX }}
                    >
                      <button
                        onClick={() => openModal(r)}
                        className="font-medium underline decoration-dotted underline-offset-2 text-left hover:text-black/80"
                        title="Ver recetas aplicadas"
                      >
                        {r.name}
                      </button>
                    </td>

                    {/* Celdas por semana */}
                    {columns.map((col, idx) => {
                      const val = r.cells?.[col] ?? 0;
                      const max = colMax[col] ?? 0;
                      return (
                        <td
                          key={col}
                          className={`px-3 py-2 text-right tabular-nums ${hoverCol === idx ? "ring-1 ring-indigo-400/50" : ""}`}
                          style={{
                            ...(cellStyleByColumn(val, max) as React.CSSProperties),
                            minWidth: ISO_COL_PX, width: ISO_COL_PX,    // conserva tu tamaño fijo si ya lo tienes
                          }}
                          title={val ? val.toFixed(3) : ""}
                          onMouseEnter={() => setHoverCol(idx)}
                          onMouseLeave={() => setHoverCol(null)}
                        >
                          {val ? val.toFixed(3) : ""}
                        </td>
                      );
                    })}


                    {/* Total fila */}
                    <td
                      className="px-3 py-2 text-right font-semibold tabular-nums"
                      style={{ minWidth: TOTAL_COL_PX, width: TOTAL_COL_PX }}
                    >
                      {r.total.toFixed(3)}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-gray-500"
                      colSpan={2 + columns.length}
                    >
                      No hay resultados para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Totales por columna */}
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-gray-50 font-semibold">
                    <td
                      className="px-3 py-2 sticky left-0 z-10 bg-gray-50"
                      style={{ minWidth: FIRST_COL_PX, width: FIRST_COL_PX }}
                    >
                      TOTAL
                    </td>
                    {columns.map((col) => {
                      const sum = rows.reduce((acc, r) => acc + (r.cells?.[col] ?? 0), 0);
                      return (
                        <td
                          key={col}
                          className="px-3 py-2 text-right tabular-nums"
                          style={{ minWidth: ISO_COL_PX, width: ISO_COL_PX }}
                        >
                          {sum.toFixed(3)}
                        </td>
                      );
                    })}
                    <td
                      className="px-3 py-2 text-right tabular-nums"
                      style={{ minWidth: TOTAL_COL_PX, width: TOTAL_COL_PX }}
                    >
                      {totalLines.toFixed(3)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        </section>
      </main>

      {/* Modal recetas */}
      {modalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeModal} aria-modal="true" role="dialog" aria-labelledby="product-recipes-title">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-start justify-between border-b px-5 py-4">
              <div>
                <h2 id="product-recipes-title" className="text-lg font-semibold text-gray-900">Recetas aplicadas — {selected.name}</h2>
                <p className="mt-0.5 text-sm text-gray-600">
                  Total para el producto: <span className="font-medium tabular-nums">{selected.total.toFixed(3)}</span> {selected.unit || ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a href={URL.createObjectURL(new Blob([productSourcesToCSV(selected)], { type: "text/csv;charset=utf-8;" }))}
                   download={`recetas_${selected.name.replace(/\s+/g,'_')}.csv`}
                   className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
                  Exportar CSV
                </a>
                <button onClick={closeModal} className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100" autoFocus title="Cerrar">
                  <span aria-hidden className="text-xl leading-none">×</span>
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-auto px-5 py-4">
              {selected.sources?.length ? (
                <table className="min-w-full text-sm">
                  <thead className="text-left text-gray-600">
                    <tr>
                      <th className="px-2 py-2">Receta</th>
                      <th className="px-2 py-2">Temporalidad</th>
                      <th className="px-2 py-2">Semana crec.</th>
                      <th className="px-2 py-2 text-right">Ocurrencias</th>
                      <th className="px-2 py-2 text-right">Aporte</th>
                      <th className="px-2 py-2 text-right">% del producto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.sources.map(s => {
                      const pct = selected.total ? (s.totalFromThisRecipe / selected.total) * 100 : 0;
                      return (
                        <tr key={s.recipeId} className="border-t">
                          <td className="px-2 py-2 font-medium text-gray-900">{s.recipeName}</td>
                          <td className="px-2 py-2 text-gray-700">{s.temporalidad || "Anual"}</td>
                          <td className="px-2 py-2 text-gray-700">S{s.growthWeek}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{s.occurrences}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{s.totalFromThisRecipe.toFixed(3)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{pct.toFixed(2)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="rounded-lg border bg-gray-50 px-4 py-6 text-center text-gray-600">
                  No hay desglose de recetas para este producto.
                </div>
              )}
            </div>

            <div className="flex justify-end border-t px-5 py-3">
              <button onClick={closeModal} className="rounded bg-black px-4 py-2 text-white hover:opacity-90">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
