"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type RecipeItemInput = {
  tempId: string;
  productId: string;
  qtyPerHectare: number | "";
  notes?: string;
};

type Product = { id: string; name: string; unit: string };

type Props = {
  mode: "create" | "edit";
  initial?: {
    id?: string;
    name: string;
    classification: "FERTILIZANTE" | "AGROQUIMICO";
    cropId: string;
    varietyId?: string | null;
    growthWeek: number;
    items: { productId: string; qtyPerHectare: number; notes?: string | null }[];
    temporalidad?: string | null;
  };
};

export default function RecipeForm({ mode, initial }: Props) {
  const router = useRouter();

  const [crops, setCrops] = useState<{ id: string; name: string }[]>([]);
  const [varieties, setVarieties] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [temporalidad, setTemporalidad] = useState<string>(initial?.temporalidad ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [classification, setClassification] = useState<"FERTILIZANTE" | "AGROQUIMICO">((initial?.classification as any) ?? "FERTILIZANTE");
  const [cropId, setCropId] = useState(initial?.cropId ?? "");
  const [varietyId, setVarietyId] = useState<string | "">(initial?.varietyId ?? "");
  const [growthWeek, setGrowthWeek] = useState<number | "">(initial?.growthWeek ?? "");
  const [items, setItems] = useState<RecipeItemInput[]>(
    (initial?.items ?? []).map((it, i) => ({
      tempId: `row-${i}`,
      productId: it.productId,
      qtyPerHectare: it.qtyPerHectare,
      notes: it.notes ?? undefined,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar catálogos
  useEffect(() => {
    (async () => {
      const [cropsRes, prodsRes] = await Promise.all([
        fetch("/api/catalogs/crops"),
        fetch("/api/products"),
      ]);
      const [cropsJson, prodsJson] = await Promise.all([cropsRes.json(), prodsRes.json()]);
      setCrops(cropsJson);
      setProducts(prodsJson);
    })();
  }, []);

  // Cargar variedades dependientes del cultivo
  useEffect(() => {
    if (!cropId) {
      setVarieties([]);
      setVarietyId("");
      return;
    }
    (async () => {
      const res = await fetch(`/api/catalogs/varieties?cropId=${cropId}`);
      setVarieties(await res.json());
    })();
  }, [cropId]);

  // Si es "crear" y no hay items, agrega una fila inicial
  useEffect(() => {
    if (mode === "create" && items.length === 0) {
      setItems([
        { tempId: crypto.randomUUID(), productId: "", qtyPerHectare: "", notes: "" },
      ]);
    }
  }, [mode]); // eslint-disable-line

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), productId: "", qtyPerHectare: "", notes: "" },
    ]);

  const removeItem = (tempId: string) =>
    setItems((prev) => prev.filter((r) => r.tempId !== tempId));

  const canSave = useMemo(() => {
    if (!name || !classification || !cropId || !growthWeek) return false;
    if (items.length === 0) return false;
    return items.every((it) => it.productId && Number(it.qtyPerHectare) > 0);
  }, [name, classification, cropId, growthWeek, items]);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        classification,
        cropId,
        varietyId: varietyId || null,
        growthWeek: Number(growthWeek),
        temporalidad: temporalidad?.trim() ? temporalidad.trim() : null,
        items: items.map((it) => ({
          productId: it.productId,
          qtyPerHectare: Number(it.qtyPerHectare),
          notes: it.notes || null,
        })),
      };

      if (mode === "create") {
        const res = await fetch("/api/recipes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setSaving(false);
        router.push(`/recipes/${json.id}`); // ir al detalle/edición
      } else {
        const res = await fetch(`/api/recipes/${initial!.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
        setSaving(false);
        router.push("/recipes"); // volver al listado
      }
    } catch (e: any) {
      setSaving(false);
      setError(e?.message ?? "Error al guardar");
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado del formulario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nombre */}
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Nombre del paquete/receta</label>
          <input
            className="w-full rounded border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Fert. Nitrógeno S3"
          />
        </div>

        {/* Clasificación */}
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Clasificación</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={classification}
            onChange={(e) => setClassification(e.target.value as any)}
          >
            <option value="FERTILIZANTE">FERTILIZANTE</option>
            <option value="AGROQUIMICO">AGROQUIMICO</option>
          </select>
        </div>

        {/* Cultivo */}
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Cultivo</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={cropId}
            onChange={(e) => setCropId(e.target.value)}
          >
            <option value="">Selecciona…</option>
            {crops.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Variedad (opcional) */}
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Variedad (opcional)</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={varietyId ?? ""}
            onChange={(e) => setVarietyId(e.target.value)}
            disabled={!cropId}
          >
            <option value="">(General para el cultivo)</option>
            {varieties.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        {/* Semana de crecimiento */}
        <div className="space-y-2">
          <label className="text-sm text-gray-700">Semana de crecimiento</label>
          <input
            type="number"
            min={1}
            className="w-full rounded border px-3 py-2"
            value={growthWeek}
            onChange={(e) =>
              setGrowthWeek(e.target.value ? Number(e.target.value) : "")
            }
            placeholder="Ej. 3"
          />
        </div>
        {/* Temporalidad (texto libre) -- NUEVO */}
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm text-gray-700">Temporalidad (opcional)</label>
          <input
            className="w-full rounded border px-3 py-2"
            value={temporalidad}
            onChange={(e) => setTemporalidad(e.target.value)}
            placeholder="Ej. Siembra de Primavera, Otoño–Invierno, etc."
          />
          <p className="text-xs text-gray-500">
            Campo descriptivo para anotar la temporalidad con la que aplica esta receta.
          </p>
        </div>       
      </div>

      {/* Ítems */}
      <div className="rounded-xl border p-4 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Ítems (dosis por hectárea)</h3>
          <button
            onClick={addItem}
            type="button"
            className="rounded bg-black px-3 py-1.5 text-white hover:opacity-90"
          >
            + Agregar ítem
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-600">
              <tr>
                <th className="px-2 py-1">Producto</th>
                <th className="px-2 py-1">Unidad</th>
                <th className="px-2 py-1">Cantidad / ha</th>
                <th className="px-2 py-1">Notas</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const prod = products.find((p) => p.id === row.productId);
                return (
                  <tr key={row.tempId} className="border-t">
                    {/* Producto */}
                    <td className="px-2 py-1">
                      <select
                        className="rounded border px-2 py-1 w-64"
                        value={row.productId}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((r) =>
                              r.tempId === row.tempId
                                ? { ...r, productId: e.target.value }
                                : r
                            )
                          )
                        }
                      >
                        <option value="">Selecciona…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Unidad */}
                    <td className="px-2 py-1 w-24">{prod?.unit ?? "—"}</td>

                    {/* Cantidad/ha */}
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="0.001"
                        className="w-32 rounded border px-2 py-1"
                        value={row.qtyPerHectare}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((r) =>
                              r.tempId === row.tempId
                                ? {
                                    ...r,
                                    qtyPerHectare:
                                      e.target.value === ""
                                        ? ""
                                        : Number(e.target.value),
                                  }
                                : r
                            )
                          )
                        }
                        placeholder="0.000"
                      />
                    </td>

                    {/* Notas */}
                    <td className="px-2 py-1">
                      <input
                        className="w-72 rounded border px-2 py-1"
                        value={row.notes ?? ""}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((r) =>
                              r.tempId === row.tempId
                                ? { ...r, notes: e.target.value }
                                : r
                            )
                          )
                        }
                        placeholder="Opcional"
                      />
                    </td>

                    {/* Eliminar */}
                    <td className="px-2 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(row.tempId)}
                        className="text-red-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-gray-500">
                    No hay ítems. Agrega al menos uno.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Hint si aún no llegan productos */}
        {products.length === 0 && (
          <p className="mt-3 text-xs text-amber-600">
            Tip: No hay productos en catálogo. Asegúrate de correr el <code>seed</code> o crear productos.
          </p>
        )}
      </div>

      {/* Errores y acciones */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          disabled={!canSave || saving}
          onClick={handleSubmit}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-40"
        >
          {saving ? "Guardando…" : mode === "create" ? "Crear receta" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
