import { OrderStatus, PaymentMethod } from "@prisma/client";

// ─── Exported seed data constants (used by tests) ────────────────────────────

export interface SeedMenuItem {
  name: string;
  description: string;
  priceInCents: number;
  isAvailable: boolean;
  sortOrder: number;
}

export interface SeedCategory {
  name: string;
  sortOrder: number;
  menuItems: SeedMenuItem[];
}

export interface SeedRestaurant {
  name: string;
  slug: string;
  email: string;
  categories: SeedCategory[];
}

export const RESTAURANTS_SEED_DATA: SeedRestaurant[] = [
  {
    name: "Pizzaria Bella",
    slug: "pizzaria-bella",
    email: "bella@example.com",
    categories: [
      {
        name: "Pizzas Tradicionais",
        sortOrder: 0,
        menuItems: [
          {
            name: "Pizza Margherita",
            description: "Molho de tomate, mussarela, manjericão fresco e azeite.",
            priceInCents: 4500,
            isAvailable: true,
            sortOrder: 0,
          },
          {
            name: "Pizza Calabresa",
            description: "Molho de tomate, mussarela, calabresa fatiada e cebola.",
            priceInCents: 4800,
            isAvailable: true,
            sortOrder: 1,
          },
          {
            name: "Pizza Frango com Catupiry",
            description: "Molho de tomate, mussarela, frango desfiado e catupiry.",
            priceInCents: 5200,
            isAvailable: true,
            sortOrder: 2,
          },
          {
            name: "Pizza Portuguesa",
            description: "Molho de tomate, mussarela, presunto, ovo, cebola e azeitona.",
            priceInCents: 5000,
            isAvailable: true,
            sortOrder: 3,
          },
        ],
      },
      {
        name: "Pizzas Especiais",
        sortOrder: 1,
        menuItems: [
          {
            name: "Pizza Quatro Queijos",
            description: "Mussarela, parmesão, gorgonzola e catupiry.",
            priceInCents: 5800,
            isAvailable: true,
            sortOrder: 0,
          },
          {
            name: "Pizza de Camarão",
            description: "Molho de tomate, mussarela, camarão temperado e palmito.",
            priceInCents: 7200,
            isAvailable: true,
            sortOrder: 1,
          },
          {
            name: "Pizza Vegetariana",
            description: "Molho de tomate, mussarela, pimentão, champignon, palmito e tomate.",
            priceInCents: 5400,
            isAvailable: true,
            sortOrder: 2,
          },
        ],
      },
      {
        name: "Bebidas",
        sortOrder: 2,
        menuItems: [
          {
            name: "Refrigerante Lata",
            description: "Coca-Cola, Guaraná ou Sprite. 350ml.",
            priceInCents: 600,
            isAvailable: true,
            sortOrder: 0,
          },
          {
            name: "Suco Natural",
            description: "Laranja, limão ou maracujá. 400ml.",
            priceInCents: 900,
            isAvailable: true,
            sortOrder: 1,
          },
          {
            name: "Água Mineral",
            description: "Sem gás ou com gás. 500ml.",
            priceInCents: 400,
            isAvailable: true,
            sortOrder: 2,
          },
        ],
      },
      {
        name: "Sobremesas",
        sortOrder: 3,
        menuItems: [
          {
            name: "Petit Gâteau",
            description: "Bolinho de chocolate quente com sorvete de baunilha.",
            priceInCents: 1800,
            isAvailable: true,
            sortOrder: 0,
          },
          {
            name: "Tiramisu",
            description: "Sobremesa italiana com mascarpone, café e cacau.",
            priceInCents: 1600,
            isAvailable: true,
            sortOrder: 1,
          },
        ],
      },
    ],
  },
  {
    name: "Sushi Zen",
    slug: "sushi-zen",
    email: "zen@example.com",
    categories: [
      {
        name: "Combinados",
        sortOrder: 0,
        menuItems: [
          {
            name: "Combinado Básico",
            description: "10 peças: 4 hossomakis, 4 uramakis e 2 niguiris.",
            priceInCents: 3800,
            isAvailable: true,
            sortOrder: 0,
          },
          {
            name: "Combinado Premium",
            description: "20 peças variadas com salmão, atum e camarão.",
            priceInCents: 6800,
            isAvailable: true,
            sortOrder: 1,
          },
          {
            name: "Combinado Família",
            description: "40 peças com grande variedade de peixes e recheios.",
            priceInCents: 12000,
            isAvailable: true,
            sortOrder: 2,
          },
        ],
      },
      {
        name: "À La Carte",
        sortOrder: 1,
        menuItems: [
          {
            name: "Niguiri de Salmão",
            description: "2 peças de niguiri com salmão fresco.",
            priceInCents: 1400,
            isAvailable: true,
            sortOrder: 0,
          },
          {
            name: "Uramaki Filadélfia",
            description: "8 peças com salmão, cream cheese e pepino.",
            priceInCents: 2600,
            isAvailable: true,
            sortOrder: 1,
          },
          {
            name: "Temaki de Atum",
            description: "Cone de alga com arroz, atum e cebolinha.",
            priceInCents: 2200,
            isAvailable: true,
            sortOrder: 2,
          },
          {
            name: "Hossomaki de Pepino",
            description: "6 peças de hossomaki vegetariano.",
            priceInCents: 1000,
            isAvailable: true,
            sortOrder: 3,
          },
          {
            name: "Edamame",
            description: "Soja cozida levemente salgada. Porção.",
            priceInCents: 800,
            isAvailable: true,
            sortOrder: 4,
          },
        ],
      },
      {
        name: "Pratos Quentes",
        sortOrder: 2,
        menuItems: [
          {
            name: "Missoshiru",
            description: "Sopa de missô com tofu e cebolinha.",
            priceInCents: 900,
            isAvailable: true,
            sortOrder: 0,
          },
          {
            name: "Gyoza",
            description: "6 pastéis japoneses de frango grelhados.",
            priceInCents: 2400,
            isAvailable: true,
            sortOrder: 1,
          },
          {
            name: "Yakissoba de Frango",
            description: "Macarrão japonês frito com legumes e frango.",
            priceInCents: 3600,
            isAvailable: true,
            sortOrder: 2,
          },
        ],
      },
      {
        name: "Bebidas",
        sortOrder: 3,
        menuItems: [
          {
            name: "Saquê Quente",
            description: "Bebida tradicional japonesa. 180ml.",
            priceInCents: 2000,
            isAvailable: true,
            sortOrder: 0,
          },
          {
            name: "Chá Verde",
            description: "Chá verde japonês. 300ml.",
            priceInCents: 700,
            isAvailable: true,
            sortOrder: 1,
          },
          {
            name: "Refrigerante Lata",
            description: "Coca-Cola, Guaraná ou Sprite. 350ml.",
            priceInCents: 600,
            isAvailable: true,
            sortOrder: 2,
          },
        ],
      },
    ],
  },
];

// ─── Sample orders data ───────────────────────────────────────────────────────

interface SampleOrder {
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod | null;
}

const SAMPLE_ORDERS: SampleOrder[] = [
  { customerName: "Ana Silva", customerPhone: "11999990001", status: "CREATED", paymentMethod: null },
  { customerName: "Bruno Costa", customerPhone: "11999990002", status: "PAYMENT_PENDING", paymentMethod: "PIX" },
  { customerName: "Carla Mendes", customerPhone: "11999990003", status: "PAYMENT_APPROVED", paymentMethod: "PIX" },
  { customerName: "Diego Rocha", customerPhone: "11999990004", status: "PREPARING", paymentMethod: "CARD" },
  { customerName: "Elena Martins", customerPhone: "11999990005", status: "READY", paymentMethod: "PIX" },
  { customerName: "Felipe Souza", customerPhone: "11999990006", status: "PICKED_UP", paymentMethod: "CARD" },
  { customerName: "Gabriela Lima", customerPhone: "11999990007", status: "CANCELLED", paymentMethod: null },
  { customerName: "Henrique Alves", customerPhone: "11999990008", status: "PAYMENT_APPROVED", paymentMethod: "PIX" },
];

// ─── Main seed function ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Lazy imports so PrismaClient is only constructed when the script runs
  const { PrismaClient } = await import("@prisma/client");
  const bcrypt = await import("bcryptjs");

  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });

  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 10);

  for (const restaurantData of RESTAURANTS_SEED_DATA) {
    console.log(`Upserting restaurant: ${restaurantData.name}`);

    // Upsert restaurant
    const restaurant = await prisma.restaurant.upsert({
      where: { slug: restaurantData.slug },
      update: { name: restaurantData.name, email: restaurantData.email, passwordHash },
      create: { name: restaurantData.name, slug: restaurantData.slug, email: restaurantData.email, passwordHash },
    });

    // Delete existing categories (cascades to menu items)
    await prisma.category.deleteMany({ where: { restaurantId: restaurant.id } });

    // Delete existing orders (cascades to order items)
    await prisma.order.deleteMany({ where: { restaurantId: restaurant.id } });

    // Create categories and menu items
    const allMenuItemRefs: { id: string; priceInCents: number; name: string }[] = [];

    for (const categoryData of restaurantData.categories) {
      const category = await prisma.category.create({
        data: {
          restaurantId: restaurant.id,
          name: categoryData.name,
          sortOrder: categoryData.sortOrder,
        },
      });

      for (const itemData of categoryData.menuItems) {
        const menuItem = await prisma.menuItem.create({
          data: {
            categoryId: category.id,
            restaurantId: restaurant.id,
            name: itemData.name,
            description: itemData.description,
            priceInCents: itemData.priceInCents,
            isAvailable: itemData.isAvailable,
            sortOrder: itemData.sortOrder,
          },
        });
        allMenuItemRefs.push({ id: menuItem.id, priceInCents: menuItem.priceInCents, name: menuItem.name });
      }
    }

    // Create sample orders
    for (let i = 0; i < SAMPLE_ORDERS.length; i++) {
      const orderData = SAMPLE_ORDERS[i];
      const orderNumber = i + 1;

      // Pick 1-3 menu items per order (cycling through available items)
      const itemCount = (i % 3) + 1;
      const startIdx = i % allMenuItemRefs.length;
      const selectedItems: typeof allMenuItemRefs = [];
      for (let j = 0; j < itemCount; j++) {
        selectedItems.push(allMenuItemRefs[(startIdx + j) % allMenuItemRefs.length]);
      }

      const totalInCents = selectedItems.reduce((sum, item) => sum + item.priceInCents, 0);

      await prisma.order.create({
        data: {
          restaurantId: restaurant.id,
          orderNumber,
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          status: orderData.status,
          paymentMethod: orderData.paymentMethod ?? undefined,
          totalInCents,
          items: {
            create: selectedItems.map((item) => ({
              menuItemId: item.id,
              name: item.name,
              priceInCents: item.priceInCents,
              quantity: 1,
            })),
          },
        },
      });
    }

    console.log(`  Created ${restaurantData.categories.length} categories and ${SAMPLE_ORDERS.length} orders.`);

    await prisma.$disconnect();
  }

  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
