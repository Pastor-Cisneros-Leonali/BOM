import Link from "next/link";

async function getCrops() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/crops`, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar la lista de cultivos");
  return res.json();
}

export default async function CropsPage() {
  const data = await getCrops();
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cultivos</h1>
        <Link href="/crops/new" className="rounded bg-black px-4 py-2 text-white hover:opacity-90">+ Nuevo cultivo</Link>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/crops/${c.id}`} className="text-blue-600 hover:underline">Editar</Link>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={2}>Aún no hay cultivos. Crea el primero.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}