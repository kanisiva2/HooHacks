"use client"

import { ErrorBoundary } from "react-error-boundary"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type PanelErrorBoundaryProps = {
  panelName: string
  className?: string
  children: React.ReactNode
}

export function PanelErrorBoundary({
  panelName,
  className,
  children,
}: PanelErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallbackRender={({ resetErrorBoundary }) => (
        <Card className={className}>
          <CardHeader>
            <CardTitle>{panelName} unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This panel hit an unexpected error. Refresh the panel or reload the page.
            </p>
            <Button size="sm" variant="outline" onClick={resetErrorBoundary}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}
      onError={(error, info) => {
        console.error(`PanelErrorBoundary(${panelName})`, error, info)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}

