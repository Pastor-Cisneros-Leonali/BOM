// Ajusta aquí los ranchos que pertenecen a cada zona.
// Usa los IDs reales de tus ranchos tal como existen en la tabla Ranch (o el catálogo que uses).
export const ZONE_RANCHES: Record<"A" | "B", string[]> = {
  A: [
    // <-- PON AQUÍ LOS ranchId DE LA ZONA A -->
    "cmh3v0ioo001zb1yioww7p28y", "cmh3v0jm200afb1yijc9ipp7m"
  ],
  B: [
    // <-- PON AQUÍ LOS ranchId DE LA ZONA B -->
    "cmh3v0ikx000wb1yior0uo1pl", "cmh3v0ihb0003b1yi2990lnq5", "cmh3v0ij7000gb1yi0d87jbmv"
  ],
};

// Opciones para el select de Zona en el cliente
export const ZONE_OPTIONS: { id: "" | "A" | "B"; name: string }[] = [
  { id: "", name: "Todas" },
  { id: "A", name: "Zona A" },
  { id: "B", name: "Zona B" },
];
