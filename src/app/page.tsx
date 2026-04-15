export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white">
      <h1 className="text-4xl font-bold">MenuApp</h1>
      <p className="mt-2 text-lg text-zinc-600">Cardápio digital para restaurantes</p>
      <a href="/admin/login" className="mt-6 rounded-lg bg-black px-6 py-3 text-white">
        Entrar
      </a>
    </main>
  );
}
