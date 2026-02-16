"use client"

import { use } from "react"
import { TeamEditor } from "@/features/team-builder/components/TeamEditor"
import { FeatureErrorBoundary } from "@/components/FeatureErrorBoundary"

export default function TeamEditorPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  return (
    <FeatureErrorBoundary name="TeamEditor">
      <TeamEditor teamId={teamId} />
    </FeatureErrorBoundary>
  )
}
