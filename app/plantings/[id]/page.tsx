import PlantingForm from "@/components/PlantingForm";
import DeleteButton from "@/components/DeleteButton";

async function getPlanting(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/plantings/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function EditPlantingPage({ params }: { params: { id: string } }) {
  const data = await getPlanting(params.id);
  if (!data) return <main className="p-6">No encontrado</main>;

  const initial = {
    id: data.id,
    cropId: data.cropId,
    varietyId: data.varietyId,
    ranchId: data.ranchId,
    plotId: data.plotId,
    hectares: data.hectares,
    sowingDate: data.sowingDate,
    harvestDate: data.harvestDate,
    status: data.status,
  } as const;

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Editar siembra</h1>
        <DeleteButton
          href={`/api/plantings/${data.id}`}
          redirectTo="/plantings"
          confirmText="¿Eliminar esta siembra? Esta acción no se puede deshacer."
        />
      </div>
      <PlantingForm mode="edit" initial={initial} />
    </main>
  );
}
