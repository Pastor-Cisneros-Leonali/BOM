import VarietyForm from "@/components/VarietyForm";

export default function NewVarietyPage() {
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Nueva variedad</h1>
      <VarietyForm mode="create" />
    </main>
  );
}