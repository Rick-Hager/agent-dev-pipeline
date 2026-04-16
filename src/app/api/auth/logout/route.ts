import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(_request: NextRequest) {
  const cookie = clearSessionCookie();

  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: { "Set-Cookie": cookie },
    }
  );
}
