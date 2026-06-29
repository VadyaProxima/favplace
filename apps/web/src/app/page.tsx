export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8">
      <h1 className="text-5xl font-bold tracking-tight">Favplace</h1>
      <p className="text-zinc-400 text-lg">
        Кольцо с рельефом вашего любимого места
      </p>
      <a
        href="/create"
        className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-zinc-950 transition hover:bg-amber-400"
      >
        Создать кольцо
      </a>
    </main>
  );
}
