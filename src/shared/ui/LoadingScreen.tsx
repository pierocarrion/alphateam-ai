import { Spinner } from "./Spinner";

interface LoadingScreenProps {
  label?: string;
}

/**
 * Pantalla de carga mostrada por Next.js (loading.tsx) mientras el servidor
 * renderiza la ruta destino. Evita que la UI se vea congelada durante la
 * navegación.
 */
export function LoadingScreen({ label = "Cargando" }: LoadingScreenProps) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-3 px-6"
      role="status"
      aria-label={label}
    >
      <Spinner size={26} />
      <span className="text-xs text-ink-3">{label}</span>
    </div>
  );
}
