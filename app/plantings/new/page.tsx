import PlantingForm from "@/components/PlantingForm";

export default function NewPlantingPage() {
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Nueva siembra</h1>
      <PlantingForm mode="create" />
    </main>
  );
}