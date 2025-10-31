
"use client";

import { useEffect, useMemo, useState } from "react";

function fmtDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString();
}

type PlanItem = {
  planting: {
    id: string;
    crop: string;
    variety: string | null;
    ranch: string;
    plot: string;
    tabla: string | null;
    hectares: number;
    sowingDate: string;
    harvestDate: string;
  };
  growthWeek: number;
  packages: {
    id: string;
    name: string;
    classification: "FERTILIZANTE" | "AGROQUIMICO";
    growthWeek: number;
    items: {
      productId: string;
      product: string;
      unit: string;
      qtyPerHectare: number;
      qtyTotal: number;
    }[];
  }[];
};

type ApiResp = {
  isoWeek: string;
  range: { start: string; end: string };
  totals: { plantings: number; hectares: number };
  plan: PlanItem[];
};

function currentIsoWeekInput(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const tmp = new Date(Date.UTC(year, now.getUTCMonth(), now.getUTCDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const diff = (tmp.getTime() - firstThursday.getTime()) / 86400000;
  const week = 1 + Math.floor(diff / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export default function WeeklyPlanPage() {
  const [iso, setIso] = useState<string>(currentIsoWeekInput());
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/weekly-plan?iso=${iso}`);
      const json: ApiResp = await res.json();
      setData(json);
      setLoading(false);
    })();
  }, [iso]);

  const titleRange = useMemo(() => {
    if (!data) return "";
    return `${fmtDate(data.range.start)} – ${fmtDate(data.range.end)}`;
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Plan semanal por semana ISO</h1>
          <p className="text-sm text-gray-600">
            Selecciona una semana ISO y consulta siembras vivas y sus paquetes/recetas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700">Semana ISO</label>
          <input
            type="week"
            value={iso}
            onChange={(e) => setIso(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </div>
      </header>

      {loading && <p className="text-gray-500">Cargando…</p>}

      {data && (
        <>
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">Semana {data.isoWeek}</h2>
                <p className="text-sm text-gray-600">{titleRange}</p>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="rounded-full border px-3 py-1">
                  Siembras vivas: <b>{data.totals.plantings}</b>
                </span>
                <span className="rounded-full border px-3 py-1">
                  Hectáreas vivas: <b className="tabular-nums">{data.totals.hectares.toFixed(2)}</b>
                </span>
              </div>
            </div>
          </section>

          {data.plan.length === 0 ? (
            <p className="text-gray-600">No hay siembras vivas para esta semana.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {data.plan.map((row) => (
                <div key={row.planting.id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-medium">
                        {row.planting.crop}
                        {row.planting.variety ? ` • ${row.planting.variety}` : ""}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {row.planting.ranch} / {row.planting.plot} • {row.planting.hectares} ha
                        {row.planting.tabla ? ` • Tabla: ${row.planting.tabla}` : ""}
                      </p>

                      <p className="text-xs text-gray-500">
                        Siembra: {fmtDate(row.planting.sowingDate)} • Cosecha: {fmtDate(row.planting.harvestDate)}
                      </p>
                    </div>
                    <span className="rounded-full border px-3 py-1 text-sm">
                      Semana de crecimiento: <b>{row.growthWeek}</b>
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {row.packages.map((p) => (
                      <div key={p.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">{p.name}</h4>
                          <span className="text-xs rounded-full border px-2 py-0.5">
                            {p.classification}
                          </span>
                        </div>
                        <ul className="mt-2 space-y-1 text-sm">
                          {p.items.map((it) => (
                            <li key={it.productId} className="flex items-center justify-between">
                              <span>{it.product} ({it.unit})</span>
                              <span className="tabular-nums">
                                {it.qtyPerHectare} /ha • <b>{it.qtyTotal}</b> total
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    {row.packages.length === 0 && (
                      <div className="text-sm text-gray-500">
                        No hay recetas definidas para la semana de crecimiento {row.growthWeek}.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
