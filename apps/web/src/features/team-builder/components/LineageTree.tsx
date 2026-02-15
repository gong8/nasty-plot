"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@nasty-plot/ui"
import type { LineageNode } from "@nasty-plot/core"

interface LineageTreeProps {
  tree: LineageNode
  currentTeamId: string
}

export function LineageTree({ tree, currentTeamId }: LineageTreeProps) {
  return (
    <div className="space-y-1">
      <TreeNode node={tree} currentTeamId={currentTeamId} depth={0} />
    </div>
  )
}

const DEFAULT_EXPAND_DEPTH = 4
const INDENT_PX_PER_LEVEL = 20
const BASE_PADDING_PX = 8

function TreeNode({
  node,
  currentTeamId,
  depth,
}: {
  node: LineageNode
  currentTeamId: string
  depth: number
}) {
  const [expanded, setExpanded] = useState(depth <= DEFAULT_EXPAND_DEPTH)
  const isCurrent = node.teamId === currentTeamId
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md text-sm",
          isCurrent ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50",
          node.isArchived && "opacity-50",
        )}
        style={{ paddingLeft: `${depth * INDENT_PX_PER_LEVEL + BASE_PADDING_PX}px` }}
      >
        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="h-5 w-5 flex items-center justify-center shrink-0"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Tree connector line */}
        {depth > 0 && <span className="text-muted-foreground text-xs">|--</span>}

        {/* Team name */}
        <Link
          href={`/teams/${node.teamId}`}
          className={cn(
            "font-medium hover:underline",
            node.isArchived && "line-through text-muted-foreground",
          )}
        >
          {node.name}
        </Link>

        {/* Branch label */}
        {node.branchName && (
          <Badge variant="secondary" className="text-xs">
            {node.branchName}
          </Badge>
        )}

        {/* Archived indicator */}
        {node.isArchived && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Archived
          </Badge>
        )}

        {/* Current indicator */}
        {isCurrent && (
          <Badge variant="default" className="text-xs">
            Current
          </Badge>
        )}

        {/* Mini sprites */}
        <div className="flex gap-0.5 ml-auto">
          {node.pokemonIds.slice(0, 6).map((id, i) => (
            <div key={`${id}-${i}`} className="h-5 w-5" title={id}>
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[6px] font-bold uppercase">
                {id.slice(0, 2)}
              </div>
            </div>
          ))}
        </div>

        {/* Date */}
        <span className="text-xs text-muted-foreground shrink-0 ml-2">
          {new Date(node.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Children */}
      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <TreeNode
            key={child.teamId}
            node={child}
            currentTeamId={currentTeamId}
            depth={depth + 1}
          />
        ))}
    </div>
  )
}
