import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { validateRestaurantInput } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const validation = validateRestaurantInput(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { name, slug, email, password } = validation.data;
    const passwordHash = await hashPassword(password);

    const restaurant = await prisma.restaurant.create({
      data: { name, slug, email, passwordHash },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        email: true,
        businessHours: true,
        stripePublishableKey: true,
        whatsappNumber: true,
        whatsappMessageTemplate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(restaurant, { status: 201 });
  } catch (error) {
    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    if (prismaError.code === "P2002") {
      const target = (prismaError.meta?.target as string[] | undefined) ?? [];
      if (target.includes("slug")) {
        return NextResponse.json(
          { error: "A restaurant with this slug already exists" },
          { status: 409 }
        );
      }
      if (target.includes("email")) {
        return NextResponse.json(
          { error: "A restaurant with this email already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "A restaurant with this slug or email already exists" },
        { status: 409 }
      );
    }

    console.error("POST /api/restaurants error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
