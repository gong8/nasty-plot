import { NextRequest } from "next/server";
import { getSession } from "@nasty-plot/llm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession(id);

    if (!session) {
      return Response.json(
        { error: "Session not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return Response.json({ data: session });
  } catch (error) {
    console.error("Get session error:", error);
    return Response.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
