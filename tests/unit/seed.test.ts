import { describe, it, expect } from "vitest";
import { RESTAURANTS_SEED_DATA } from "../../prisma/seed";

describe("seed data structure", () => {
  it("has exactly 2 restaurants", () => {
    expect(RESTAURANTS_SEED_DATA).toHaveLength(2);
  });

  it("each restaurant has required fields (name, slug, email)", () => {
    for (const restaurant of RESTAURANTS_SEED_DATA) {
      expect(restaurant).toHaveProperty("name");
      expect(restaurant).toHaveProperty("slug");
      expect(restaurant).toHaveProperty("email");
      expect(typeof restaurant.name).toBe("string");
      expect(typeof restaurant.slug).toBe("string");
      expect(typeof restaurant.email).toBe("string");
      expect(restaurant.name.length).toBeGreaterThan(0);
      expect(restaurant.slug.length).toBeGreaterThan(0);
      expect(restaurant.email.length).toBeGreaterThan(0);
    }
  });

  it("slugs are unique across restaurants", () => {
    const slugs = RESTAURANTS_SEED_DATA.map((r) => r.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });

  it("each restaurant's menu items all have priceInCents as positive integers", () => {
    for (const restaurant of RESTAURANTS_SEED_DATA) {
      for (const category of restaurant.categories) {
        for (const item of category.menuItems) {
          expect(Number.isInteger(item.priceInCents)).toBe(true);
          expect(item.priceInCents).toBeGreaterThan(0);
        }
      }
    }
  });
});
