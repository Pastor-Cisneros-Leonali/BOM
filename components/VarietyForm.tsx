"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Crop = { id: string; name: string };

type Props = { mode: "create" | "edit"; initial?: { id?: string; name: string; cropId: string } };

export default function VarietyForm({ mode, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [cropId, setCropId] = useState(initial?.cropId ?? "");
  const [crops, setCrops] = useState<Crop[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => !!name.trim() && !!cropId, [name, cropId]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/catalogs/crops");
      setCrops(await res.json());
    })();
  }, []);

  const handleSubmit = async () => {
    if (!canSave) return;
    setSaving(true); setError(null);
    try {
      if (mode === "create") {
        const res = await fetch("/api/varieties", { method: "POST", body: JSON.stringify({ name, cropId }) });
        if (!res.ok) throw new Error(await res.text());
        router.push("/varieties");
      } else {
        const res = await fetch(`/api/varieties/${initial!.id}`, { method: "PUT", body: JSON.stringify({ name, cropId }) });
        if (!res.ok) throw new Error(await res.text());
        router.push("/varieties");
      }
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Nombre de la variedad</label>
          <input className="w-full rounded border px-3 py-2" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Pioneer 30V53" />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Cultivo</label>
          <select className="w-full rounded border px-3 py-2" value={cropId} onChange={e => setCropId(e.target.value)}>
            <option value="">Selecciona…</option>
            {crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button disabled={!canSave || saving} onClick={handleSubmit} className="rounded bg-black px-4 py-2 text-white disabled:opacity-40">
          {saving ? "Guardando…" : mode === "create" ? "Crear variedad" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}