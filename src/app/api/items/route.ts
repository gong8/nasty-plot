import { NextResponse } from "next/server";
import { getAllItems, searchItems } from "@/modules/pokemon-data";
import type { PaginatedResponse, ItemData } from "@/shared/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)));

  const items: ItemData[] = search ? searchItems(search) : getAllItems();

  const total = items.length;
  const start = (page - 1) * pageSize;
  const data = items.slice(start, start + pageSize);

  const response: PaginatedResponse<ItemData> = {
    data,
    total,
    page,
    pageSize,
  };

  return NextResponse.json(response);
}
