import { NextRequest, NextResponse } from "next/server"
import { getBatchSimulation, deleteBatchSimulation } from "@nasty-plot/battle-engine"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params
  const batch = await getBatchSimulation(batchId)

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 })
  }

  return NextResponse.json({
    ...batch,
    analytics: batch.analytics ? JSON.parse(batch.analytics) : null,
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params
  try {
    await deleteBatchSimulation(batchId)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 })
  }
}
