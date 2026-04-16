import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SettingsForm, { type SettingsData } from "@/components/SettingsForm";
import LogoutButton from "@/components/LogoutButton";

function maskSecret(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 4) return "****";
  return `****${value.slice(-4)}`;
}

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const auth = token ? await verifyJwt(token) : null;

  if (!auth) {
    redirect("/backoffice/login");
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: auth.restaurantId },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      email: true,
      businessHours: true,
      stripePublishableKey: true,
      stripeSecretKey: true,
      whatsappNumber: true,
      whatsappMessageTemplate: true,
    },
  });

  if (!restaurant) {
    redirect("/backoffice/login");
  }

  const initialSettings: SettingsData = {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    logo: restaurant.logo ?? "",
    email: restaurant.email,
    businessHours: restaurant.businessHours
      ? JSON.stringify(restaurant.businessHours, null, 2)
      : "",
    stripePublishableKey: restaurant.stripePublishableKey ?? "",
    stripeSecretKeyMasked: maskSecret(restaurant.stripeSecretKey),
    whatsappNumber: restaurant.whatsappNumber ?? "",
    whatsappMessageTemplate: restaurant.whatsappMessageTemplate ?? "",
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="w-full px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {auth.slug} — Configurações
          </h1>
          <LogoutButton />
        </div>
      </header>
      <div className="w-full px-6 py-8 max-w-2xl">
        <SettingsForm initialSettings={initialSettings} slug={auth.slug} />
      </div>
    </main>
  );
}
