import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

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
          sortOrder: true,
        },
      },
    },
  });

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">{restaurant.name}</h1>
      {categories.map((category) => (
        <section key={category.id} className="mb-8">
          <h2 className="text-xl font-semibold mb-3 border-b pb-1">
            {category.name}
          </h2>
          <ul className="space-y-4">
            {category.menuItems.map((item) => (
              <li key={item.id} className="flex justify-between items-start">
                <div className="flex-1 mr-4">
                  <p className="font-medium">{item.name}</p>
                  {item.description ? (
                    <p
                      data-testid="item-description"
                      className="text-sm text-zinc-500 mt-0.5"
                    >
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <p className="font-medium whitespace-nowrap">
                  R${" "}
                  {(item.priceInCents / 100).toFixed(2).replace(".", ",")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
