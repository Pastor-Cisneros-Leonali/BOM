import RecipeForm from "@/components/RecipeForm";

async function getRecipe(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/recipes/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function EditRecipePage({ params }: { params: { id: string } }) {
  const data = await getRecipe(params.id);
  if (!data) return <main className="p-6">No encontrado</main>;

  const initial = {
    id: data.id,
    name: data.name,
    classification: data.classification,
    cropId: data.cropId,
    varietyId: data.varietyId,
    growthWeek: data.growthWeek,
    temporalidad: data.temporalidad ?? null,
    items: (data.items ?? []).map((it: any) => ({
      productId: it.productId,
      qtyPerHectare: it.qtyPerHectare,
      notes: it.notes,
    })),
  } as const;

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Editar receta</h1>
        {/* Sugerencia: crea un pequeño Client Component para eliminar con router.push("/recipes") */}
      </div>

      <RecipeForm mode="edit" initial={initial} />
    </main>
  );
}
