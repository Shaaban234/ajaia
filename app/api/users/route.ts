import { NextResponse } from "next/server";
import { USERS } from "@/lib/users";
import { errorResponse, requireUser } from "@/lib/api";

/** Directory of users the caller can share with. */
export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({ users: USERS });
  } catch (err) {
    return errorResponse(err);
  }
}
