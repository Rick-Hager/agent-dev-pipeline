import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyJwt, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MenuManager } from "@/components/MenuManager";
import LogoutButton from "@/components/LogoutButton";

export default async function MenuPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const auth = token ? await verifyJwt(token) : null;

  if (!auth) {
    redirect("/backoffice/login");
  }

  const categories = await prisma.category.findMany({
    where: { restaurantId: auth.restaurantId },
    include: {
      menuItems: {
        include: {
          images: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="w-full px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/backoffice/dashboard"
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              {auth.slug} — Cardápio
            </h1>
          </div>
          <LogoutButton />
        </div>
      </header>
      <div className="w-full px-6 py-8">
        <MenuManager slug={auth.slug} initialCategories={categories} />
      </div>
    </main>
  );
}
