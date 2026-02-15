import { NextRequest, NextResponse } from "next/server"
import {
  formatShowdownLog,
  formatShowdownReplayJSON,
  type BattleRecord,
} from "@nasty-plot/battle-engine"
import { getBattleForExport } from "@nasty-plot/battle-engine/db"
import { notFoundResponse } from "../../../../../lib/api-error"
import { validateSearchParams } from "../../../../../lib/validation"
import { battleExportSearchSchema } from "../../../../../lib/schemas/battle.schemas"

export async function GET(req: NextRequest, { params }: { params: Promise<{ battleId: string }> }) {
  const { battleId } = await params
  const [searchParams, error] = validateSearchParams(req.url, battleExportSearchSchema)
  if (error) return error

  const battle = await getBattleForExport(battleId)

  if (!battle) {
    return notFoundResponse("Battle")
  }

  const record = battle as unknown as BattleRecord

  if (searchParams.format === "json") {
    const json = formatShowdownReplayJSON(record)
    return NextResponse.json(json)
  }

  // Default: raw Showdown log
  const log = formatShowdownLog(record)
  return new NextResponse(log, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename=battle-${battleId}.log`,
    },
  })
}
