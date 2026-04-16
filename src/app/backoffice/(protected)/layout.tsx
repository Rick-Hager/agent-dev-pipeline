import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const auth = token ? await verifyJwt(token) : null;

  if (!auth) {
    redirect("/backoffice/login");
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: auth.restaurantId },
    select: { name: true, slug: true },
  });

  const restaurantName = restaurant?.name ?? auth.slug;
  const restaurantSlug = restaurant?.slug ?? auth.slug;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminNav restaurantName={restaurantName} restaurantSlug={restaurantSlug} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
