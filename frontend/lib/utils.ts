import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(input: string | number) {
  const timestamp = typeof input === "string" ? +new Date(input) : input
  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) {
    return "just now"
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function severityToBadgeVariant(severity: string) {
  if (severity === "P1") {
    return "destructive" as const
  }
  if (severity === "P2") {
    return "secondary" as const
  }
  return "outline" as const
}

export function confidenceToPercentage(confidence: number) {
  return `${Math.round(confidence * 100)}%`
}

export function statusToColorClass(value: string) {
  if (value === "P0" || value === "P1") {
    return "bg-red-100 text-red-700"
  }
  if (value === "P2") {
    return "bg-amber-100 text-amber-700"
  }
  return "bg-blue-100 text-blue-700"
}
