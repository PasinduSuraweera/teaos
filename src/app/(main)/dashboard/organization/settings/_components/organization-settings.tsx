"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Plus, Edit, Trash2, X, Loader2, Mail, Copy, Check, Crown, Shield, UserCircle, Eye, Building2, CalendarDays, Clock } from "lucide-react"
import { useOrganization } from "@/contexts/organization-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table/data-table"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { ColumnDef } from "@tanstack/react-table"
import { useDataTableInstance } from "@/hooks/use-data-table-instance"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { supabase } from "@/lib/supabase"
import { OrganizationRole } from "@/types/database"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import { sendInviteEmail } from "@/server/email-actions"
import { useRouter } from "next/navigation"

interface Member {
  id: string
  user_id: string
  email: string
  full_name: string | null
  role: OrganizationRole
  accepted_at: string | null
  created_at: string | null
}

interface Invitation {
  id: string
  email: string
  role: OrganizationRole
  created_at: string
  expires_at: string
  token: string
}

const roleIcons: Record<OrganizationRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  manager: UserCircle,
  viewer: Eye,
}

function getRoleBadgeVariant(role: OrganizationRole): "default" | "secondary" | "outline" | "destructive" {
  switch (role) {
    case 'owner': return 'default'
    case 'admin': return 'secondary'
    default: return 'outline'
  }
}

export function OrganizationSettings() {
  const { currentOrganization, loading: orgLoading, isOwner, canManageMembers, user, refreshOrganizations, deleteOrganization } = useOrganization()
  const orgId = currentOrganization?.organization_id
  const router = useRouter()

  const [orgName, setOrgName] = useState("")
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Modal states
  const [showOrgForm, setShowOrgForm] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  
  // Invite form
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("viewer")
  const [inviting, setInviting] = useState(false)
  
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  useEffect(() => {
    if (orgId) {
      setOrgName(currentOrganization?.organization_name || "")
      fetchMembers()
      fetchInvitations()
    }
  }, [orgId])

  async function fetchMembers() {
    if (!orgId) return
    
    try {
      // Direct query to get members
      const { data, error } = await supabase
        .from('organization_members')
        .select('id, user_id, role, accepted_at, created_at')
        .eq('organization_id', orgId)

      if (error) {
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          setMembers([])
          return
        }
        throw error
      }

      // For now, use user_id as email placeholder - emails will show once we fix the RPC
      const memberDetails: Member[] = (data || []).map(member => ({
        id: member.id,
        user_id: member.user_id,
        email: member.user_id, // Will show user ID for now
        full_name: null,
        role: member.role,
        accepted_at: member.accepted_at,
        created_at: member.created_at,
      }))

      setMembers(memberDetails)
    } catch (error: any) {
      console.error('Error fetching members:', error?.message || error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchInvitations() {
    if (!orgId) return
    
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('id, email, role, created_at, expires_at, token')
        .eq('organization_id', orgId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())

      if (error) {
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          setInvitations([])
          return
        }
        throw error
      }
      setInvitations(data || [])
    } catch (error: any) {
      console.error('Error fetching invitations:', error?.message || error)
    }
  }

  async function handleSaveOrgName(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId || !orgName.trim()) return
    
    if (!isOwner) {
      toast.error("Only organization owners can update the name")
      return
    }
    
    setSaving(true)
    try {
      console.log('Updating org via RPC. OrgId:', orgId, 'New name:', orgName.trim())
      
      // Use the SECURITY DEFINER function to bypass RLS
      const { data, error } = await supabase.rpc('update_organization', {
        p_org_id: orgId,
        p_name: orgName.trim()
      })

      console.log('RPC result:', data, 'Error:', error ? JSON.stringify(error) : null)
      
      if (error) {
        console.error('Error updating org:', JSON.stringify(error, null, 2))
        throw error
      }
      
      await refreshOrganizations()
      toast.success("Organization name updated")
      setShowOrgForm(false)
    } catch (error: any) {
      console.error('Error updating org name:', error?.message || error)
      toast.error(error?.message || "Failed to update organization name")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteOrganization() {
    if (!orgId || !isOwner) {
      toast.error("Only organization owners can delete the organization")
      return
    }

    try {
      const success = await deleteOrganization(orgId)
      
      if (success) {
        toast.success("Organization deleted successfully")
        // Redirect to dashboard after deletion
        router.push('/dashboard')
      } else {
        toast.error("Failed to delete organization")
      }
    } catch (error: any) {
      console.error('Error deleting organization:', error?.message || error)
      toast.error(error?.message || "Failed to delete organization")
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId || !inviteEmail.trim()) return
    
    if (!isOwner) {
      toast.error("Only organization owners can send invitations")
      return
    }

    const emailToInvite = inviteEmail.toLowerCase().trim()

    // Check if email is already a member
    const existingMember = members.find(m => m.email.toLowerCase() === emailToInvite)
    if (existingMember) {
      toast.error("This person is already a member of your organization")
      return
    }

    // Check if there's already a pending invitation for this email
    const existingInvite = invitations.find(i => i.email.toLowerCase() === emailToInvite)
    if (existingInvite) {
      toast.error("An invitation has already been sent to this email")
      return
    }
    
    setInviting(true)
    try {
      const token = crypto.randomUUID()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      console.log('Creating invitation via RPC. OrgId:', orgId)
      
      // Use the SECURITY DEFINER function to bypass RLS
      const { data, error } = await supabase.rpc('create_invitation', {
        p_org_id: orgId,
        p_email: emailToInvite,
        p_role: inviteRole,
        p_token: token,
        p_expires_at: expiresAt.toISOString()
      })

      if (error) {
        console.error('Invitation error:', JSON.stringify(error, null, 2))
        throw error
      }

      console.log('Invitation created with id:', data)
      
      // Send email notification
      const inviteLink = `${window.location.origin}/invite/${token}`
      const emailResult = await sendInviteEmail(
        emailToInvite,
        currentOrganization?.organization_name || 'Organization',
        inviteLink
      )
      
      if (emailResult.success) {
        toast.success("Invitation sent!")
      } else {
        // Invitation created but email failed - still show success but note email issue
        toast.success("Invitation created (email notification may not have been sent)")
        console.warn('Email send failed:', emailResult.error)
      }
      
      setInviteEmail("")
      setInviteRole("viewer")
      setShowInviteForm(false)
      fetchInvitations()
    } catch (error: any) {
      console.error('Error creating invitation:', error?.message || error)
      toast.error(error?.message || "Failed to create invitation")
    } finally {
      setInviting(false)
    }
  }

  const handleCancelInvitation = useCallback(async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId)

      if (error) throw error
      toast.success("Invitation cancelled")
      fetchInvitations()
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel invitation")
    }
  }, [])

  const handleRemoveMember = useCallback(async (memberId: string, memberUserId: string) => {
    if (memberUserId === user?.id) {
      toast.error("You cannot remove yourself")
      return
    }
    
    if (!confirm("Remove this member from the organization?")) return
    
    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error
      toast.success("Member removed")
      setMembers(prev => prev.filter(m => m.id !== memberId))
    } catch (error: any) {
      toast.error(error?.message || "Failed to remove member")
    }
  }, [user?.id])

  const handleUpdateRole = useCallback(async (memberId: string, newRole: OrganizationRole) => {
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('id', memberId)

      if (error) throw error
      toast.success("Role updated")
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
    } catch (error: any) {
      toast.error(error?.message || "Failed to update role")
    }
  }, [])

  function copyInviteLink(token: string) {
    const link = `${window.location.origin}/invite/${token}`
    navigator.clipboard.writeText(link)
    setCopiedToken(token)
    toast.success("Invite link copied")
    setTimeout(() => setCopiedToken(null), 2000)
  }

  // Member columns
  const memberColumns: ColumnDef<Member>[] = useMemo(() => [
    {
      accessorKey: "user_id",
      header: "ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.getValue<string>("user_id").slice(0, 8)}...
        </span>
      ),
    },
    {
      id: "member",
      header: "Name",
      cell: ({ row }) => {
        const member = row.original
        const isCurrentUser = member.user_id === user?.id
        const RoleIcon = roleIcons[member.role]
        return (
          <div className="flex items-center gap-2">
            <RoleIcon className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="font-medium">
                {member.full_name || '-'}
                {isCurrentUser && <span className="text-muted-foreground text-xs ml-1">(you)</span>}
              </span>
              <span className="text-xs text-muted-foreground">{member.email}</span>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const member = row.original
        const isCurrentUser = member.user_id === user?.id
        
        if (canManageMembers && !isCurrentUser && member.role !== 'owner') {
          return (
            <Select
              value={member.role}
              onValueChange={(v) => handleUpdateRole(member.id, v as OrganizationRole)}
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          )
        }
        
        return (
          <Badge variant={getRoleBadgeVariant(member.role)} className="text-xs capitalize">
            {member.role}
          </Badge>
        )
      },
    },
    {
      accessorKey: "accepted_at",
      header: "Joined",
      cell: ({ row }) => {
        const acceptedAt = row.original.accepted_at
        if (!acceptedAt) return <span className="text-muted-foreground text-xs">-</span>
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground cursor-help flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {formatDistanceToNow(new Date(acceptedAt), { addSuffix: true })}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{format(new Date(acceptedAt), 'MMMM dd, yyyy')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const member = row.original
        const isCurrentUser = member.user_id === user?.id
        
        if (!canManageMembers || isCurrentUser || member.role === 'owner') return null
        
        return (
          <div className="flex gap-1 justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveMember(member.id, member.user_id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove member</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )
      },
    },
  ], [user?.id, canManageMembers, handleRemoveMember, handleUpdateRole])

  // Invitation columns
  const invitationColumns: ColumnDef<Invitation>[] = useMemo(() => [
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{row.getValue("email")}</span>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs capitalize">
          {row.getValue("role")}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Sent",
      cell: ({ row }) => {
        const createdAt = row.getValue("created_at") as string
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-muted-foreground cursor-help flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{format(new Date(createdAt), 'MMMM dd, yyyy')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
    {
      accessorKey: "expires_at",
      header: "Expires",
      cell: ({ row }) => {
        const expiresAt = row.getValue("expires_at") as string
        return (
          <span className="text-sm text-muted-foreground">
            {format(new Date(expiresAt), 'MMM d')}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const invite = row.original
        return (
          <div className="flex gap-1 justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => copyInviteLink(invite.token)}
                  >
                    {copiedToken === invite.token ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy invite link</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleCancelInvitation(invite.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cancel invitation</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )
      },
    },
  ], [copiedToken, handleCancelInvitation])

  const membersTable = useDataTableInstance({
    data: members,
    columns: memberColumns,
    getRowId: (row) => row.id,
  })

  const invitationsTable = useDataTableInstance({
    data: invitations,
    columns: invitationColumns,
    getRowId: (row) => row.id,
  })

  if (orgLoading || !orgId) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading organization...</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold">Organization Settings</h2>
          {isOwner && (
            <Button onClick={() => setShowOrgForm(true)} variant="outline" size="sm">
              <Edit className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Edit Organization</span>
            </Button>
          )}
        </div>
      </div>

      {/* Organization Info Card */}
      <Card className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-muted">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">{currentOrganization?.organization_name}</p>
            <p className="text-xs text-muted-foreground font-mono">/{currentOrganization?.organization_slug}</p>
          </div>
        </div>
      </Card>

      {/* Team Members Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Team Members</CardTitle>
              <CardDescription className="text-xs">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </CardDescription>
            </div>
            {canManageMembers && (
              <Button onClick={() => setShowInviteForm(true)} size="sm">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Invite</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-[400px] overflow-auto rounded-md border">
            <DataTable table={membersTable} columns={memberColumns} />
          </div>
          <DataTablePagination table={membersTable} />
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pending Invitations</CardTitle>
            <CardDescription className="text-xs">
              {invitations.length} pending {invitations.length === 1 ? 'invitation' : 'invitations'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[300px] overflow-auto rounded-md border">
              <DataTable table={invitationsTable} columns={invitationColumns} />
            </div>
            <DataTablePagination table={invitationsTable} />
          </CardContent>
        </Card>
      )}

      {/* Danger Zone - Delete Organization (Owner Only) */}
      {isOwner && (
        <Card className="border-destructive">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
            <CardDescription className="text-xs">
              Permanently delete this organization and all associated data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Organization
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the organization
                    <strong> {currentOrganization?.organization_name}</strong> and remove all members' access.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteOrganization}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Organization
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* Edit Organization Name Modal */}
      {showOrgForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Edit Organization</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowOrgForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription className="text-xs">
                Update your organization name
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveOrgName} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="orgName" className="text-xs">Organization Name *</Label>
                  <Input
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="My Organization"
                    className="h-8"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowOrgForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={saving || !orgName.trim()}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Invite Member</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowInviteForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription className="text-xs">
                Send an invitation to join your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="h-8"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role" className="text-xs">Role *</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrganizationRole)}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {inviteRole === 'viewer' && 'Can view data only'}
                    {inviteRole === 'manager' && 'Can view and edit data'}
                    {inviteRole === 'admin' && 'Can manage members and data'}
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowInviteForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={inviting || !inviteEmail.trim()}>
                    {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Send Invite
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
