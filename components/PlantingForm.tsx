"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Opt = { id: string; name: string };

type Props = {
  mode: "create" | "edit";
  initial?: {
    id?: string;
    cropId: string;
    varietyId?: string | null;
    ranchId: string;
    plotId: string;
    hectares: number;
    sowingDate: string; // ISO
    harvestDate: string; // ISO
    status?: "ACTIVE" | "HARVESTED" | "CANCELLED";
  };
};

export default function PlantingForm({ mode, initial }: Props) {
  const router = useRouter();

  const [crops, setCrops] = useState<Opt[]>([]);
  const [varieties, setVarieties] = useState<Opt[]>([]);
  const [ranches, setRanches] = useState<Opt[]>([]);
  const [plots, setPlots] = useState<Opt[]>([]);

  const [cropId, setCropId] = useState(initial?.cropId ?? "");
  const [varietyId, setVarietyId] = useState<string | "">(initial?.varietyId ?? "");
  const [ranchId, setRanchId] = useState(initial?.ranchId ?? "");
  const [plotId, setPlotId] = useState(initial?.plotId ?? "");
  const [hectares, setHectares] = useState<number | "">(initial?.hectares ?? "");
  const [sowingDate, setSowingDate] = useState<string>(initial?.sowingDate?.slice(0,10) ?? "");
  const [harvestDate, setHarvestDate] = useState<string>(initial?.harvestDate?.slice(0,10) ?? "");
  const [status, setStatus] = useState<"ACTIVE"|"HARVESTED"|"CANCELLED">(initial?.status ?? "ACTIVE");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [cropsRes, ranchesRes] = await Promise.all([
        fetch("/api/catalogs/crops"),
        fetch("/api/catalogs/ranches"),
      ]);
      setCrops(await cropsRes.json());
      setRanches(await ranchesRes.json());
    })();
  }, []);

  useEffect(() => {
    if (!cropId) { setVarieties([]); setVarietyId(""); return; }
    (async () => {
      const res = await fetch(`/api/catalogs/varieties?cropId=${cropId}`);
      setVarieties(await res.json());
    })();
  }, [cropId]);

  useEffect(() => {
    if (!ranchId) { setPlots([]); setPlotId(""); return; }
    (async () => {
      const res = await fetch(`/api/catalogs/plots?ranchId=${ranchId}`);
      setPlots(await res.json());
    })();
  }, [ranchId]);

  const canSave = useMemo(() => {
    return !!cropId && !!ranchId && !!plotId && Number(hectares) > 0 && !!sowingDate && !!harvestDate;
  }, [cropId, ranchId, plotId, hectares, sowingDate, harvestDate]);

  const handleSubmit = async () => {
    if (!canSave) return;
    setSaving(true); setError(null);
    try {
      const payload = {
        cropId,
        varietyId: varietyId || null,
        ranchId,
        plotId,
        hectares: Number(hectares),
        sowingDate,
        harvestDate,
        status,
      };
      if (mode === "create") {
        const res = await fetch("/api/plantings", { method: "POST", body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(await res.text());
        router.push("/plantings");
      } else {
        const res = await fetch(`/api/plantings/${initial!.id}`, { method: "PUT", body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(await res.text());
        router.push("/plantings");
      }
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Materia prima</label>
          <select className="w-full rounded border px-3 py-2" value={cropId} onChange={e => setCropId(e.target.value)}>
            <option value="">Selecciona…</option>
            {crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Variedad (opcional)</label>
          <select className="w-full rounded border px-3 py-2" value={varietyId ?? ""} onChange={e => setVarietyId(e.target.value)} disabled={!cropId}>
            <option value="">(General para el cultivo)</option>
            {varieties.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Rancho</label>
          <select className="w-full rounded border px-3 py-2" value={ranchId} onChange={e => setRanchId(e.target.value)}>
            <option value="">Selecciona…</option>
            {ranches.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Lote</label>
          <select className="w-full rounded border px-3 py-2" value={plotId} onChange={e => setPlotId(e.target.value)} disabled={!ranchId}>
            <option value="">Selecciona…</option>
            {plots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Hectáreas</label>
          <input type="number" step="0.01" className="w-full rounded border px-3 py-2" value={hectares} onChange={e => setHectares(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Fecha de siembra</label>
          <input type="date" className="w-full rounded border px-3 py-2" value={sowingDate} onChange={e => setSowingDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Fecha de cosecha (estimada)</label>
          <input type="date" className="w-full rounded border px-3 py-2" value={harvestDate} onChange={e => setHarvestDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Estado</label>
          <select className="w-full rounded border px-3 py-2" value={status} onChange={e => setStatus(e.target.value as any)}>
            <option value="ACTIVE">ACTIVA</option>
            <option value="HARVESTED">COSECHADA</option>
            <option value="CANCELLED">CANCELADA</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button disabled={!canSave || saving} onClick={handleSubmit} className="rounded bg-black px-4 py-2 text-white disabled:opacity-40">
          {saving ? "Guardando…" : mode === "create" ? "Crear siembra" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}