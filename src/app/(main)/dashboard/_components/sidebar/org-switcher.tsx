"use client"

import { useState } from "react"
import { Building2, Check, ChevronsUpDown, Plus, Settings } from "lucide-react"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrganization } from "@/contexts/organization-context"
import { getInitials } from "@/lib/utils"

export function OrgSwitcher() {
  const router = useRouter()
  const { 
    organizations, 
    currentOrganization, 
    setCurrentOrganization, 
    loading,
    isOwner 
  } = useOrganization()
  const [open, setOpen] = useState(false)

  if (loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!currentOrganization) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton 
            size="lg"
            onClick={() => router.push('/dashboard/organization/new')}
          >
            <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
              <Plus className="size-4" />
            </div>
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="font-semibold">Create Organization</span>
              <span className="text-muted-foreground text-xs">Get started</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                  {getInitials(currentOrganization.organization_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold truncate max-w-[140px]">
                  {currentOrganization.organization_name}
                </span>
                <span className="text-muted-foreground text-xs capitalize">
                  {currentOrganization.user_role}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side="bottom"
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Organizations
            </DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.organization_id}
                onClick={() => {
                  setCurrentOrganization(org)
                  setOpen(false)
                }}
                className="gap-2 p-2"
              >
                <Avatar className="size-6 rounded-md">
                  <AvatarFallback className="rounded-md text-xs">
                    {getInitials(org.organization_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate">{org.organization_name}</span>
                {org.organization_id === currentOrganization.organization_id && (
                  <Check className="size-4" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setOpen(false)
                router.push('/dashboard/organization/settings')
              }}
              className="gap-2"
            >
              <Settings className="size-4" />
              Organization Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setOpen(false)
                router.push('/dashboard/organization/new')
              }}
              className="gap-2"
            >
              <Plus className="size-4" />
              Create Organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
