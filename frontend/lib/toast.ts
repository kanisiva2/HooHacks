"use client"

import { toast } from "sonner"

export function toastTaskSynced(issueKey: string | null) {
  toast.success(issueKey ? `Task synced to Jira: ${issueKey}` : "Task synced to Jira")
}

export function toastTaskDismissed() {
  toast.info("Task dismissed")
}

export function toastDeepDiveTriggered() {
  toast.info("Deep dive started")
}

export function toastDeepDiveComplete() {
  toast.success("Deep dive complete")
}

export function toastBotJoined() {
  toast.success("Sprynt AI joined the meeting")
}

export function toastConnectionReconnecting() {
  toast.warning("Connection unstable — reconnecting...")
}

export function toastConnectionRestored() {
  toast.success("Connection restored")
}

export function toastError(message: string) {
  toast.error(message)
}

