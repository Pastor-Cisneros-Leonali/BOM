import CropForm from "@/components/CropForm";

export default function NewCropPage() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Nuevo cultivo</h1>
      <CropForm mode="create" />
    </main>
  );
}