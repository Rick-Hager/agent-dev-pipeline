import { cookies } from "next/headers";
import Link from "next/link";
import { verifyJwt, COOKIE_NAME } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const auth = token ? await verifyJwt(token) : null;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="w-full px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {auth?.slug ?? "Backoffice"} — Dashboard
          </h1>
          <LogoutButton />
        </div>
      </header>
      <div className="w-full px-6 py-8">
        <p className="text-gray-600 mb-6">Welcome to the backoffice dashboard.</p>
        <div className="flex flex-col gap-3 max-w-sm">
          <Link
            href="/backoffice/menu"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 text-center"
          >
            Gerenciar cardápio
          </Link>
        </div>
      </div>
    </main>
  );
}
