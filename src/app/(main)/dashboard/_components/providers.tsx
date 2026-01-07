"use client"

import { ReactNode } from "react"
import { OrganizationProvider } from "@/contexts/organization-context"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <OrganizationProvider>
      {children}
    </OrganizationProvider>
  )
}
