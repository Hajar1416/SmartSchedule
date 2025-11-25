"use client"

import { Avatar, AvatarFallback, AvatarImage } from "./avatar"

export interface CollaborationParticipant {
  id: string
  name: string
  avatar_url?: string | null
  isOnline: boolean
}

interface CollaborationIndicatorProps {
  participants: CollaborationParticipant[]
}

export function CollaborationIndicator({ participants }: CollaborationIndicatorProps) {
  const online = participants.filter(p => p.isOnline)
  const visible = online.slice(0, 3)
  const extra = online.length - visible.length

  if (online.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-3 rounded-full border px-3 py-1 bg-emerald-50 shadow-sm">
      <div className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-semibold text-emerald-800">
          Collaboration on
        </span>
      </div>
      <div className="flex items-center -space-x-2">
        {visible.map(p => (
          <Avatar
            key={p.id}
            className="h-7 w-7 border border-white shadow-sm"
            title={p.name}
          >
            {p.avatar_url ? (
              <AvatarImage src={p.avatar_url} />
            ) : (
              <AvatarFallback className="bg-emerald-600 text-white text-xs">
                {p.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
        ))}
        {extra > 0 && (
          <div className="h-7 w-7 rounded-full bg-emerald-800 text-white text-[10px] flex items-center justify-center border border-white shadow-sm">
            +{extra}
          </div>
        )}
      </div>
    </div>
  )
}
