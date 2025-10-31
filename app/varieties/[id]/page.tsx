import VarietyForm from "@/components/VarietyForm";
import DeleteButton from "@/components/DeleteButton";

async function getVariety(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/varieties/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function EditVarietyPage({ params }: { params: { id: string } }) {
  const data = await getVariety(params.id);
  if (!data) return <main className="p-6">No encontrado</main>;

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Editar variedad</h1>
        <DeleteButton
          href={`/api/varieties/${data.id}`}
          redirectTo="/varieties"
          confirmText="Esta acción eliminará la variedad (si no tiene dependencias). ¿Continuar?"
        />
      </div>
      <VarietyForm mode="edit" initial={{ id: data.id, name: data.name, cropId: data.cropId }} />
    </main>
  );
}
