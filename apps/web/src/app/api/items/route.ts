import { NextResponse } from "next/server"
import { listItems, searchItems } from "@nasty-plot/pokemon-data"
import { getFormatItems } from "@nasty-plot/formats"
import { parseIntQueryParam, type PaginatedResponse, type ItemData } from "@nasty-plot/core"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const formatId = searchParams.get("formatId")
  const page = parseIntQueryParam(searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER)
  const pageSize = parseIntQueryParam(searchParams.get("pageSize"), 50, 1, 100)

  let items: ItemData[]
  if (formatId) {
    const formatItems = getFormatItems(formatId)
    items = search
      ? formatItems.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
      : formatItems
  } else {
    items = search ? searchItems(search) : listItems()
  }

  const total = items.length
  const start = (page - 1) * pageSize
  const data = items.slice(start, start + pageSize)

  const response: PaginatedResponse<ItemData> = {
    data,
    total,
    page,
    pageSize,
  }

  return NextResponse.json(response)
}
