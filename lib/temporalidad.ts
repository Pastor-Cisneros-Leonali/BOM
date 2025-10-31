// lib/temporalidad.ts
const MONTHS_ES = [
  "ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"
];

function norm(s: string) {
  return s
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .trim().toUpperCase();
}

function mesIdx(token: string): number | null {
  const t = norm(token).slice(0,3); // acepta "Abril" -> "ABR"
  const i = MONTHS_ES.indexOf(t);
  return i >= 0 ? i + 1 : null; // 1..12
}

/**
 * Acepta formatos:
 *  - "Oct-Ene" (rango cruzando año)
 *  - "Abril-Sep" (rango mismo año)
 *  - "Anual" (siempre)
 *  - Múltiples rangos separados por coma: "Feb-Mar, Oct-Nov"
 */
export function temporalidadCoincide(temporalidad: string | null | undefined, d: Date): boolean {
  if (!temporalidad || norm(temporalidad) === "ANUAL") return true;

  const m = d.getUTCMonth() + 1; // 1..12
  const parts = temporalidad.split(","); // por si hay múltiples

  for (const raw of parts) {
    const seg = norm(raw);
    const [a, b] = seg.split(/[-–—]/).map(s => s.trim()); // -, – o —
    if (!a) continue;

    const start = mesIdx(a);
    const end = b ? mesIdx(b) : start;
    if (!start || !end) continue;

    if (start <= end) {
      // rango dentro del mismo año (p.ej. ABR(4)-SEP(9))
      if (m >= start && m <= end) return true;
    } else {
      // rango que cruza año (p.ej. OCT(10)-ENE(1))
      if (m >= start || m <= end) return true;
    }
  }

  return false;
}
