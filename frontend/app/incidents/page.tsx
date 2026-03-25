"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock,
  Plus,
  Search,
  Siren,
  Trash2,
} from "lucide-react";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { StartIncidentModal } from "@/components/incident/StartIncidentModal";
import { OnboardingGate } from "@/components/shared/OnboardingGate";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteIncident, useIncidents } from "@/hooks/useIncident";
import { toastError } from "@/lib/toast";
import { usePrimaryWorkspace } from "@/hooks/useWorkspaces";
import { cn, formatRelativeTime, severityToBadgeVariant } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import type { Incident } from "@/types/api";
import { toast } from "sonner";

function statusColor(status: string) {
  if (status === "active") return "bg-emerald-500";
  if (status === "resolved") return "bg-blue-400";
  return "bg-slate-300";
}

function severityAccent(severity: string) {
  if (severity === "P1") return "border-l-red-500";
  if (severity === "P2") return "border-l-amber-400";
  if (severity === "P3") return "border-l-blue-400";
  return "border-l-slate-300";
}

const SWIPE_REVEAL_PX = 96;
const SWIPE_OPEN_THRESHOLD_PX = 52;

function SwipeableIncidentCard({
  incident,
  isDeletePending,
  onRequestDelete,
}: {
  incident: Incident;
  isDeletePending: boolean;
  onRequestDelete: (incident: Incident) => void;
}) {
  const router = useRouter();
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const dragDistanceRef = useRef(0);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState(0);

  function snapOpen() {
    setOffset(SWIPE_REVEAL_PX);
    setDragging(false);
  }

  function snapClosed() {
    setOffset(0);
    setDragging(false);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    pointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX - offset;
    dragDistanceRef.current = 0;
    suppressClickRef.current = false;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || pointerIdRef.current !== event.pointerId) {
      return;
    }
    const next = Math.min(
      SWIPE_REVEAL_PX,
      Math.max(0, event.clientX - startXRef.current),
    );
    dragDistanceRef.current = Math.max(
      dragDistanceRef.current,
      Math.abs(next - offset),
    );
    setOffset(next);
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }
    pointerIdRef.current = null;
    suppressClickRef.current = dragDistanceRef.current > 6;
    if (offset >= SWIPE_OPEN_THRESHOLD_PX) {
      snapOpen();
    } else {
      snapClosed();
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released.
    }
  }

  function handleCardClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (offset > 0) {
      snapClosed();
      return;
    }
    router.push(`/incidents/${incident.id}`);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-red-500 shadow-[0_10px_24px_rgba(248,113,113,0.18)]">
      <div className="absolute inset-y-0 left-0 flex w-24 items-stretch justify-start">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRequestDelete(incident);
          }}
          disabled={isDeletePending}
          className="flex w-full items-center justify-center gap-2 rounded-l-2xl px-4 text-sm font-medium text-white transition hover:bg-red-600/20 disabled:cursor-not-allowed disabled:text-white/70"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>

      <div
        className={cn(
          "relative touch-pan-y select-none rounded-2xl transition-transform duration-200 ease-out",
          dragging && "transition-none",
        )}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={dragging ? handlePointerEnd : undefined}
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleCardClick();
          }
        }}
      >
        <div
          className={cn(
            "group flex cursor-pointer items-center gap-4 rounded-2xl border border-l-4 border-slate-200 bg-white p-4 text-left transition-all hover:bg-white hover:shadow-md md:p-5",
            severityAccent(incident.severity),
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <Siren
              className={cn(
                "h-5 w-5",
                incident.status === "active"
                  ? "text-red-500"
                  : "text-slate-400",
              )}
            />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-slate-950">
              {incident.title}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    statusColor(incident.status),
                  )}
                />
                <span className="capitalize">{incident.status}</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(incident.created_at)}
              </span>
            </div>
          </div>

          <Badge
            variant={severityToBadgeVariant(incident.severity)}
            className="shrink-0"
          >
            {incident.severity}
          </Badge>

          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600" />
        </div>
      </div>
    </div>
  );
}

export default function IncidentsPage() {
  const { workspace, isLoading: workspaceLoading } = usePrimaryWorkspace();
  const incidents = useIncidents(workspace?.id);
  const deleteIncident = useDeleteIncident(workspace?.id);
  const modals = useUIStore((state) => state.modals);
  const setModalOpen = useUIStore((state) => state.setModalOpen);
  const [incidentToDelete, setIncidentToDelete] = useState<Incident | null>(null);

  const sortedIncidents = useMemo(
    () =>
      [...(incidents.data ?? [])].sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
      ),
    [incidents.data],
  );

  const activeCount = useMemo(
    () => sortedIncidents.filter((i) => i.status === "active").length,
    [sortedIncidents],
  );

  return (
    <ProtectedPage>
      <OnboardingGate>
        <div className="flex min-h-screen bg-[linear-gradient(180deg,#f8f5ef_0%,#f5f2ec_100%)]">
          <Sidebar />
          <main className="flex-1 overflow-y-auto px-4 pb-20 pt-6 md:px-8 md:pb-8">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 md:text-3xl">
                    Incidents
                  </h1>
                  {!workspaceLoading && sortedIncidents.length > 0 && (
                    <Badge variant="secondary" className="tabular-nums">
                      {sortedIncidents.length} total
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  View all incident rooms and their current status.
                </p>
              </div>
              <Button
                disabled={!workspace}
                onClick={() => setModalOpen("startIncident", true)}
                size="lg"
                className="rounded-2xl bg-slate-950 px-5 shadow-[0_8px_20px_rgba(15,23,42,0.14)] hover:bg-slate-800"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Start Incident
              </Button>
            </div>

            {/* Active indicator */}
            {activeCount > 0 && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-sm text-emerald-700">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-medium">
                  {activeCount} active incident{activeCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* Content */}
            {workspaceLoading || incidents.isLoading ? (
              <div className="grid gap-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-2xl border border-white/70 bg-white/72 p-5 backdrop-blur-sm"
                  >
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : sortedIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/72 py-16 text-center backdrop-blur-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                  <Search className="h-7 w-7 text-slate-400" />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-slate-900">
                  No incidents yet
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                  Start your first incident room to begin live transcript
                  streaming, task extraction, and AI-powered deep dive
                  analysis.
                </p>
                <Button
                  className="mt-6 rounded-2xl bg-slate-950 px-5 shadow-[0_8px_20px_rgba(15,23,42,0.14)] hover:bg-slate-800"
                  onClick={() => setModalOpen("startIncident", true)}
                  disabled={!workspace}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Start First Incident
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {sortedIncidents.map((incident) => (
                  <SwipeableIncidentCard
                    key={incident.id}
                    incident={incident}
                    isDeletePending={
                      deleteIncident.isPending &&
                      deleteIncident.variables === incident.id
                    }
                    onRequestDelete={setIncidentToDelete}
                  />
                ))}
              </div>
            )}

            <Dialog
              open={Boolean(incidentToDelete)}
              onOpenChange={(open) => {
                if (!open && !deleteIncident.isPending) {
                  setIncidentToDelete(null);
                }
              }}
            >
              <DialogContent className="max-w-md rounded-3xl border border-white/70 bg-white/92 p-0 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur-xl">
                <DialogHeader className="px-6 pt-6">
                  <DialogTitle className="text-xl tracking-[-0.03em] text-slate-950">
                    Delete incident?
                  </DialogTitle>
                  <DialogDescription className="text-sm leading-6 text-slate-600">
                    {incidentToDelete ? (
                      <>
                        This will permanently remove{" "}
                        <span className="font-medium text-slate-900">
                          {incidentToDelete.title}
                        </span>
                        , along with its transcript, tasks, deep dive results,
                        and any saved S3 artifacts.
                      </>
                    ) : null}
                  </DialogDescription>
                  {incidentToDelete?.status === "active" ? (
                    <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      This incident is still active. Deleting it will also stop
                      the connected bot session if one is running.
                    </p>
                  ) : null}
                </DialogHeader>

                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    disabled={deleteIncident.isPending}
                    onClick={() => setIncidentToDelete(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="rounded-2xl bg-red-500 text-white hover:bg-red-600"
                    disabled={!incidentToDelete || deleteIncident.isPending}
                    onClick={async () => {
                      if (!incidentToDelete) {
                        return;
                      }
                      try {
                        await deleteIncident.mutateAsync(incidentToDelete.id);
                        toast.success("Incident deleted");
                        setIncidentToDelete(null);
                      } catch {
                        toastError("Failed to delete incident");
                      }
                    }}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    {deleteIncident.isPending ? "Deleting..." : "Delete Incident"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {workspace ? (
              <StartIncidentModal
                open={modals.startIncident}
                onOpenChange={(open) => setModalOpen("startIncident", open)}
                workspaceId={workspace.id}
              />
            ) : null}
          </main>
          <MobileNav />
        </div>
      </OnboardingGate>
    </ProtectedPage>
  );
}
