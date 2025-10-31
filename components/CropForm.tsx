"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  mode: "create" | "edit";
  initial?: { id?: string; name: string };
};

export default function CropForm({ mode, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = !!name.trim();

  const handleSubmit = async () => {
    if (!canSave) return;
    setSaving(true); setError(null);
    try {
      if (mode === "create") {
        const res = await fetch("/api/crops", { method: "POST", body: JSON.stringify({ name }) });
        if (!res.ok) throw new Error(await res.text());
        router.push("/crops");
      } else {
        const res = await fetch(`/api/crops/${initial!.id}`, { method: "PUT", body: JSON.stringify({ name }) });
        if (!res.ok) throw new Error(await res.text());
        router.push("/crops");
      }
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm text-gray-700">Nombre del cultivo</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Maíz, Tomate"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={!canSave || saving}
          onClick={handleSubmit}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-40"
        >
          {saving ? "Guardando…" : mode === "create" ? "Crear cultivo" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}