import CropForm from "@/components/CropForm";

async function getCrop(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/crops/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function EditCropPage({ params }: { params: { id: string } }) {
  const data = await getCrop(params.id);
  if (!data) return <main className="p-6">No encontrado</main>;
  const initial = { id: data.id, name: data.name } as const;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Editar cultivo</h1>
        {/* Botón eliminar opcional */}
      </div>
      <CropForm mode="edit" initial={initial} />
      <form
        className="mt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await fetch(`/api/crops/${data.id}`, { method: "DELETE" });
          if (res.ok) {
            // @ts-ignore
            window.location.href = "/crops";
          } else {
            alert(await res.text());
          }
        }}
      >
        <button className="rounded border px-4 py-2 text-red-600 hover:bg-red-50" type="submit">Eliminar cultivo</button>
      </form>
    </main>
  );
}