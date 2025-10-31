"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  href: string;         // endpoint, ej: `/api/varieties/ID`
  redirectTo: string;   // a dónde navegar tras borrar, ej: `/varieties`
  confirmText?: string; // mensaje opcional
  label?: string;       // texto del botón
  className?: string;
};

export default function DeleteButton({
  href,
  redirectTo,
  confirmText = "¿Seguro que deseas eliminar?",
  label = "Eliminar",
  className,
}: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    if (loading) return;
    if (!window.confirm(confirmText)) return;

    setLoading(true);
    try {
      const res = await fetch(href, { method: "DELETE" });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "No se pudo eliminar");
      }
      router.push(redirectTo);
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Error al eliminar");
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={className ?? "rounded border px-4 py-2 text-red-600 hover:bg-red-50 disabled:opacity-40"}
    >
      {loading ? "Eliminando…" : label}
    </button>
  );
}
