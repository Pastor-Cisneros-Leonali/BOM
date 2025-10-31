import RecipeForm from "@/components/RecipeForm";

export default function NewRecipePage() {
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Nueva receta</h1>
      <RecipeForm mode="create" />
    </main>
  );
}
