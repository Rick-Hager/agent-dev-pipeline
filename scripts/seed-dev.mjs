import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString =
  process.env.SEED_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable";
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const PASSWORD = "senha123";
const passwordHash = await bcrypt.hash(PASSWORD, 10);

const seeds = [
  {
    name: "Pizzaria do João",
    slug: "pizzaria-do-joao",
    email: "joao@pizzaria.com",
    categories: [
      {
        name: "Pizzas",
        sortOrder: 0,
        items: [
          { name: "Margherita", priceInCents: 3500, sortOrder: 0 },
          { name: "Calabresa", priceInCents: 3800, sortOrder: 1 },
          { name: "Portuguesa", priceInCents: 4000, sortOrder: 2 },
        ],
      },
      {
        name: "Bebidas",
        sortOrder: 1,
        items: [
          { name: "Coca-Cola 2L", priceInCents: 1200, sortOrder: 0 },
          { name: "Guaraná 2L", priceInCents: 1000, sortOrder: 1 },
        ],
      },
    ],
  },
  {
    name: "Burger Station",
    slug: "burger-station",
    email: "contato@burgerstation.com",
    categories: [
      {
        name: "Hambúrgueres",
        sortOrder: 0,
        items: [
          { name: "Cheese Burger", priceInCents: 2500, sortOrder: 0 },
          { name: "Bacon Burger", priceInCents: 2800, sortOrder: 1 },
          { name: "X-Tudo", priceInCents: 3200, sortOrder: 2 },
        ],
      },
      {
        name: "Acompanhamentos",
        sortOrder: 1,
        items: [
          { name: "Fritas", priceInCents: 1200, sortOrder: 0 },
          { name: "Onion Rings", priceInCents: 1400, sortOrder: 1 },
        ],
      },
    ],
  },
];

for (const s of seeds) {
  const existing = await prisma.restaurant.findUnique({ where: { slug: s.slug } });
  if (existing) {
    console.log(`skip: ${s.slug} already exists`);
    continue;
  }
  const restaurant = await prisma.restaurant.create({
    data: { name: s.name, slug: s.slug, email: s.email, passwordHash },
  });
  for (const cat of s.categories) {
    const category = await prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name: cat.name,
        sortOrder: cat.sortOrder,
      },
    });
    for (const item of cat.items) {
      await prisma.menuItem.create({
        data: {
          restaurantId: restaurant.id,
          categoryId: category.id,
          name: item.name,
          priceInCents: item.priceInCents,
          sortOrder: item.sortOrder,
        },
      });
    }
  }
  console.log(`created: ${s.slug} (${restaurant.id})`);
}

await prisma.$disconnect();
await pool.end();
