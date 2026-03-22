"use client"

import { Badge } from "@/components/ui/badge"
import { useIncidentStore } from "@/stores/incidentStore"

export function ReconnectionBanner() {
  const connectionStatus = useIncidentStore((store) => store.connectionStatus)

  if (connectionStatus === "connected" || connectionStatus === "connecting") {
    return null
  }

  if (connectionStatus === "reconnecting") {
    return (
      <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            Reconnecting
          </Badge>
          <span>Connection interrupted. Attempting to reconnect...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      <div className="flex items-center gap-2">
        <Badge variant="destructive">Disconnected</Badge>
        <span>Connection lost after multiple retries. Reload to retry.</span>
      </div>
    </div>
  )
}

