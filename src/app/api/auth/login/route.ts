import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { signJwt, createSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { email, password } = body as { email?: unknown; password?: unknown };

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { email },
    });

    if (!restaurant) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const passwordValid = await verifyPassword(
      password,
      restaurant.passwordHash
    );

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = await signJwt({
      restaurantId: restaurant.id,
      slug: restaurant.slug,
      email: restaurant.email,
    });

    const cookie = createSessionCookie(token);

    return NextResponse.json(
      {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        email: restaurant.email,
      },
      {
        status: 200,
        headers: { "Set-Cookie": cookie },
      }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
