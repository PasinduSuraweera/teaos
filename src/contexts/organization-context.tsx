"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { Organization, OrganizationRole, UserOrganization } from '@/types/database'
import { User } from '@supabase/supabase-js'

interface OrganizationContextType {
  // Current user
  user: User | null
  loading: boolean
  
  // Organizations
  organizations: UserOrganization[]
  currentOrganization: UserOrganization | null
  
  // Current role in org
  userRole: OrganizationRole | null
  
  // Actions
  setCurrentOrganization: (org: UserOrganization) => void
  refreshOrganizations: () => Promise<void>
  createOrganization: (name: string) => Promise<string | null>
  deleteOrganization: (organizationId: string) => Promise<boolean>
  
  // Permission helpers
  canEdit: boolean // owner, admin, manager
  canManageMembers: boolean // owner, admin
  canDelete: boolean // owner, admin
  isOwner: boolean // owner only
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

const ORG_STORAGE_KEY = 'current_organization_id'

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [organizations, setOrganizations] = useState<UserOrganization[]>([])
  const [currentOrganization, setCurrentOrganizationState] = useState<UserOrganization | null>(null)
  
  const supabase = createBrowserClient()
  
  // Get user's organizations - only creates if user has NO organizations at all
  const createDefaultOrganization = useCallback(async (): Promise<UserOrganization | null> => {
    if (!user) return null
    
    try {
      // IMPORTANT: Double-check that user really has no orgs before creating
      const { data: existingOrgs } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('owner_id', user.id)
        .limit(1)
      
      if (existingOrgs && existingOrgs.length > 0) {
        // User already has an org, return it instead of creating
        return {
          organization_id: existingOrgs[0].id,
          organization_name: existingOrgs[0].name,
          organization_slug: existingOrgs[0].slug,
          user_role: 'owner'
        }
      }
      
      // Generate a unique slug
      const baseSlug = 'my-org'
      let slug = `${baseSlug}-${Date.now()}`
      
      // Insert organization
      const { data: newOrg, error: insertError } = await supabase
        .from('organizations')
        .insert({
          name: 'My Organization',
          slug,
          owner_id: user.id
        })
        .select('id, name, slug')
        .single()
      
      if (insertError) {
        console.error('Error creating organization:', insertError.message)
        return null
      }
      
      // Add user as owner member
      await supabase
        .from('organization_members')
        .insert({
          organization_id: newOrg.id,
          user_id: user.id,
          role: 'owner',
          accepted_at: new Date().toISOString()
        })
      
      return {
        organization_id: newOrg.id,
        organization_name: newOrg.name,
        organization_slug: newOrg.slug,
        user_role: 'owner'
      }
    } catch (error: any) {
      console.error('Error in createDefaultOrganization:', error?.message || error)
      return null
    }
  }, [user, supabase])

  const refreshOrganizations = useCallback(async () => {
    if (!user) {
      setOrganizations([])
      setCurrentOrganizationState(null)
      return
    }
    
    try {
      // First try to get orgs where user is owner
      const { data: ownedOrgs, error: ownedError } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('owner_id', user.id)
      
      // Also get orgs where user is a member
      const { data: memberOrgs, error: memberError } = await supabase
        .from('organization_members')
        .select(`
          role,
          organization:organizations (id, name, slug)
        `)
        .eq('user_id', user.id)
        .not('accepted_at', 'is', null)
      
      // Combine owned and member orgs
      const allOrgs: UserOrganization[] = []
      
      // Add owned orgs
      if (ownedOrgs && ownedOrgs.length > 0) {
        ownedOrgs.forEach(org => {
          allOrgs.push({
            organization_id: org.id,
            organization_name: org.name,
            organization_slug: org.slug,
            user_role: 'owner'
          })
        })
      }
      
      // Add member orgs (if not already added as owned)
      if (memberOrgs && memberOrgs.length > 0) {
        memberOrgs.forEach((m: any) => {
          if (m.organization && !allOrgs.find(o => o.organization_id === m.organization.id)) {
            allOrgs.push({
              organization_id: m.organization.id,
              organization_name: m.organization.name,
              organization_slug: m.organization.slug,
              user_role: m.role as OrganizationRole
            })
          }
        })
      }
      
      // If no orgs found, create one
      if (allOrgs.length === 0) {
        console.log('No organizations found, creating default...')
        const newOrg = await createDefaultOrganization()
        if (newOrg) {
          setOrganizations([newOrg])
          setCurrentOrganizationState(newOrg)
          localStorage.setItem(ORG_STORAGE_KEY, newOrg.organization_id)
          return
        }
        // If creation failed, the tables might not exist yet
        console.warn('Could not create organization - tables may not exist')
        setOrganizations([])
        setCurrentOrganizationState(null)
        return
      }
      
      setOrganizations(allOrgs)
      
      // Restore or set current org
      const savedOrgId = localStorage.getItem(ORG_STORAGE_KEY)
      const savedOrg = allOrgs.find(o => o.organization_id === savedOrgId)
      
      if (savedOrg) {
        setCurrentOrganizationState(savedOrg)
      } else {
        setCurrentOrganizationState(allOrgs[0])
        localStorage.setItem(ORG_STORAGE_KEY, allOrgs[0].organization_id)
      }
    } catch (error: any) {
      console.error('Error in refreshOrganizations:', error?.message || error)
      setOrganizations([])
      setCurrentOrganizationState(null)
    }
  }, [user, supabase, createDefaultOrganization])
  
  // Set current organization
  const setCurrentOrganization = useCallback((org: UserOrganization) => {
    setCurrentOrganizationState(org)
    localStorage.setItem(ORG_STORAGE_KEY, org.organization_id)
  }, [])
  
  // Create new organization
  const createOrganization = useCallback(async (name: string): Promise<string | null> => {
    if (!user) return null
    
    try {
      const { data, error } = await supabase.rpc('create_organization', {
        p_name: name,
        p_owner_id: user.id
      })
      
      if (error) {
        console.error('Error creating organization:', error)
        return null
      }
      
      const newOrgId = data as string
      
      // Fetch the updated organizations list
      const { data: memberships } = await supabase
        .from('organization_members')
        .select(`
          organization_id,
          role,
          organization:organizations (
            id,
            name,
            slug
          )
        `)
        .eq('user_id', user.id)
      
      if (memberships) {
        const allOrgs: UserOrganization[] = []
        memberships.forEach((m: any) => {
          if (m.organization) {
            allOrgs.push({
              organization_id: m.organization.id,
              organization_name: m.organization.name,
              organization_slug: m.organization.slug,
              user_role: m.role as OrganizationRole
            })
          }
        })
        
        setOrganizations(allOrgs)
        
        // Find and auto-select the newly created organization
        const newOrg = allOrgs.find(o => o.organization_id === newOrgId)
        if (newOrg) {
          setCurrentOrganization(newOrg)
        }
      }
      
      return newOrgId
    } catch (error) {
      console.error('Error in createOrganization:', error)
      return null
    }
  }, [user, supabase, setCurrentOrganization])
  
  // Delete organization (owner only)
  const deleteOrganization = useCallback(async (organizationId: string): Promise<boolean> => {
    if (!user) return false
    
    try {
      // Delete the organization (cascade will handle members and invitations via DB constraints)
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', organizationId)
        .eq('owner_id', user.id) // Ensure only owner can delete
      
      if (error) {
        console.error('Error deleting organization:', error)
        return false
      }
      
      // Refresh organizations list
      await refreshOrganizations()
      
      return true
    } catch (error) {
      console.error('Error in deleteOrganization:', error)
      return false
    }
  }, [user, supabase, refreshOrganizations])
  
  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )
    
    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    
    return () => subscription.unsubscribe()
  }, [supabase])
  
  // Load organizations when user changes
  useEffect(() => {
    if (user) {
      refreshOrganizations()
    } else {
      setOrganizations([])
      setCurrentOrganizationState(null)
    }
  }, [user, refreshOrganizations])
  
  // Computed permissions
  const userRole = currentOrganization?.user_role ?? null
  const canEdit = userRole === 'owner' || userRole === 'admin' || userRole === 'manager'
  const canManageMembers = userRole === 'owner' || userRole === 'admin'
  const canDelete = userRole === 'owner' || userRole === 'admin'
  const isOwner = userRole === 'owner'
  
  return (
    <OrganizationContext.Provider
      value={{
        user,
        loading,
        organizations,
        currentOrganization,
        userRole,
        setCurrentOrganization,
        refreshOrganizations,
        createOrganization,
        deleteOrganization,
        canEdit,
        canManageMembers,
        canDelete,
        isOwner,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}

// Helper hook to get organization ID for queries
export function useOrgId() {
  const { currentOrganization } = useOrganization()
  return currentOrganization?.organization_id ?? null
}
