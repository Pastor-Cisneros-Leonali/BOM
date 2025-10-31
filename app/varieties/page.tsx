import Link from "next/link";

async function getVarieties() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/varieties`, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar la lista de variedades");
  return res.json();
}

export default async function VarietiesPage() {
  const data = await getVarieties();
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Variedades</h1>
        <Link href="/varieties/new" className="rounded bg-black px-4 py-2 text-white hover:opacity-90">+ Nueva variedad</Link>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Variedad</th>
              <th className="px-3 py-2">Cultivo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((v: any) => (
              <tr key={v.id} className="border-top">
                <td className="px-3 py-2 font-medium">{v.name}</td>
                <td className="px-3 py-2">{v.crop?.name}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/varieties/${v.id}`} className="text-blue-600 hover:underline">Editar</Link>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={3}>Aún no hay variedades. Crea la primera.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}