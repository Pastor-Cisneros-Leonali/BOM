
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Agro • Paquetes por Semana</h1>
      <p className="text-gray-600">
        Selecciona una semana ISO para ver siembras vivas y las recetas/paquetes que corresponden.
      </p>
      <Link
        href="/plan"
        className="inline-block rounded-lg bg-black px-4 py-2 text-white hover:opacity-90"
      >
        Ir al plan semanal
      </Link>
     <br></br> 
      <Link
        href="/recipes"
        className="inline-block rounded-lg bg-black px-4 py-2 text-white hover:opacity-90"
      >
        Recetas
      </Link>
           <br></br> 
      <Link
        href="/plantings"
        className="inline-block rounded-lg bg-black px-4 py-2 text-white hover:opacity-90"
      >
        Planeación
      </Link>
                 <br></br> 
      <Link
        href="/crops"
        className="inline-block rounded-lg bg-black px-4 py-2 text-white hover:opacity-90"
      >
        Materia prima
      </Link>
                       <br></br> 
      <Link
        href="/warehouse"
        className="inline-block rounded-lg bg-black px-4 py-2 text-white hover:opacity-90"
      >
        Vistas almacen
      </Link>
    </main>
  );
}
