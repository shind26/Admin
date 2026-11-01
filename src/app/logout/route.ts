import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export async function GET(request: Request) {
  await clearSessionCookie();
  const url = new URL("/login", request.url);
  return NextResponse.redirect(url);
}

