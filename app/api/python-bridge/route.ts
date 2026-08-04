import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const reqText = await req.text();
    const body = reqText && reqText.trim() ? JSON.parse(reqText) : {};
    const { path, method = "GET", payload } = body;
    const pythonBase = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || "http://localhost:5000";

    const targetUrl = `${pythonBase}${path && path.startsWith('/') ? path : '/' + (path || '')}`;

    const res = await fetch(targetUrl, {
      method,
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const resText = await res.text();
    const data = resText && resText.trim() ? JSON.parse(resText) : {};

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Python Backend unreachable", fallback: true },
      { status: 503 }
    );
  }
}
