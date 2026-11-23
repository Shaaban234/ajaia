import { NextResponse } from "next/server";
import { DEMO_PASSWORD, findUserByEmail } from "@/lib/users";
import { SESSION_COOKIE, currentUser, encodeSession } from "@/lib/session";
import { errorResponse, HttpError, readJson } from "@/lib/api";

export async function GET() {
  return NextResponse.json({ user: await currentUser() });
}

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const user = typeof body.email === "string" ? findUserByEmail(body.email) : undefined;
    if (!user || body.password !== DEMO_PASSWORD) throw new HttpError(401, "Invalid email or password.");
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, encodeSession(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
