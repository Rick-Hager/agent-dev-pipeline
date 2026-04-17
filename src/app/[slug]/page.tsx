import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import CartBadge from "@/components/CartBadge";
import AddToCartButton from "@/components/AddToCartButton";
import { MenuItemRow } from "@/components/MenuItemRow";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function MenuPage({ params }: PageProps) {
  const { slug } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
  });

  if (!restaurant) {
    notFound();
  }

  const categories = await prisma.category.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      sortOrder: true,
      menuItems: {
        where: { isAvailable: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          priceInCents: true,
          imageUrl: true,
          sortOrder: true,
          images: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, url: true, sortOrder: true },
          },
        },
      },
    },
  });

  return (
    <main className="max-w-lg mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{restaurant.name}</h1>
        <CartBadge slug={slug} />
      </div>
      {categories.map((category) => (
        <section key={category.id} className="mb-8">
          <h2 className="text-xl font-semibold mb-3 border-b pb-1">
            {category.name}
          </h2>
          <ul className="space-y-4">
            {category.menuItems.map((item) => {
              const itemImages = item.images ?? [];
              const galleryImages =
                itemImages.length > 0
                  ? itemImages
                  : item.imageUrl
                  ? [
                      {
                        id: `legacy-${item.id}`,
                        url: item.imageUrl,
                        sortOrder: 0,
                      },
                    ]
                  : [];

              return (
                <li key={item.id}>
                  <MenuItemRow
                    name={item.name}
                    description={item.description}
                    priceInCents={item.priceInCents}
                    images={galleryImages}
                    addToCart={
                      <AddToCartButton
                        item={{
                          id: item.id,
                          name: item.name,
                          priceInCents: item.priceInCents,
                        }}
                      />
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
