import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.VINTED_SERVICE_URL || "http://localhost:4000";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.text();
    const res = await fetch(`${API_URL}/api/offers/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": session.user.id,
      },
      body,
    });
    
    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || "An unknown error occurred" };
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || data.message || `Request failed with status ${res.status}` }, 
        { status: res.status }
      );
    }
    
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Vinted service unreachable" }, { status: 502 });
  }
}
