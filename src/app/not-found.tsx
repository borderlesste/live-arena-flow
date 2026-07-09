import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-center text-foreground">
      <div className="surface-card max-w-lg rounded-xl p-8">
        <Image
          src="/brand/symbols/symbol-white.png"
          alt="Símbolo de Luis Romero Fútbol"
          width={96}
          height={95}
          className="mx-auto h-auto w-24 object-contain"
        />
        <p className="mt-6 font-display text-6xl font-bold text-primary">404</p>
        <h1 className="mt-3 font-display text-2xl font-semibold">No encontramos esa página</h1>
        <p className="mt-2 text-sm text-muted-foreground">Vuelve a Luis Romero Fútbol para seguir los partidos y transmisiones disponibles.</p>
        <Link href="/" className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover">Volver al inicio</Link>
      </div>
    </main>
  );
}
