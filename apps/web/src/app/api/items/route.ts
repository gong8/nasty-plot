import { NextResponse } from "next/server"
import { listItems, searchItems } from "@nasty-plot/pokemon-data"
import { getFormatItems } from "@nasty-plot/formats"
import { type PaginatedResponse, type ItemData } from "@nasty-plot/core"
import { apiErrorResponse } from "../../../lib/api-error"
import { validateSearchParams } from "../../../lib/validation"
import { itemsSearchSchema } from "../../../lib/schemas/data.schemas"

export async function GET(request: Request) {
  const [params, error] = validateSearchParams(request.url, itemsSearchSchema)
  if (error) return error

  try {
    const { search, formatId, page, pageSize } = params

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

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600" },
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
