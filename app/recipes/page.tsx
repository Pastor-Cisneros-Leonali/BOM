import Link from "next/link";

async function getRecipes() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/recipes`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("No se pudo cargar la lista de recetas");
  return res.json();
}

export default async function RecipesPage() {
  const data = await getRecipes();

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recetas</h1>
        <Link
          href="/recipes/new"
          className="rounded bg-black px-4 py-2 text-white hover:opacity-90"
        >
          + Nueva receta
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Clasificación</th>
              <th className="px-3 py-2">Cultivo</th>
              <th className="px-3 py-2">Variedad</th>
              <th className="px-3 py-2">Semana</th>
              <th className="px-3 py-2">Temporalidad</th> {/* NUEVO */}
              <th className="px-3 py-2">Tipo siembra</th> {/* NUEVO */}
              <th className="px-3 py-2">Ítems</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">{r.classification}</td>
                <td className="px-3 py-2">{r.crop?.name}</td>
                <td className="px-3 py-2">{r.variety?.name ?? "—"}</td>
                <td className="px-3 py-2">{r.growthWeek}</td>
                <td className="px-3 py-2">{r.temporalidad ?? "—"}</td> {/* NUEVO */}
                <td className="px-3 py-2">{r.sowingType ?? "—"}</td>   {/* NUEVO */}
                <td className="px-3 py-2">{r.items.length}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/recipes/${r.id}`} className="text-blue-600 hover:underline">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                {/* Aumenta colSpan por las 2 columnas nuevas */}
                <td className="px-3 py-6 text-center text-gray-500" colSpan={9}>
                  Aún no hay recetas. Crea la primera.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
