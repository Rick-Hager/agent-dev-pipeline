import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt, COOKIE_NAME } from "@/lib/auth";
import { OrdersClient } from "@/components/OrdersClient";

export default async function OrdersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const auth = token ? await verifyJwt(token) : null;

  if (!auth) {
    redirect("/backoffice/login");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="w-full px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {auth.slug} — Pedidos
          </h1>
        </div>
      </header>
      <div className="w-full px-6 py-8">
        <OrdersClient slug={auth.slug} />
      </div>
    </main>
  );
}
