"use client"

import { useOrganization } from '@/contexts/organization-context'
import { supabase } from '@/lib/supabase'

/**
 * Hook that returns organization-aware query helpers
 * Automatically adds organization_id filter to queries
 */
export function useOrgQuery() {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.organization_id
  
  /**
   * Add organization_id filter to a query builder
   * Usage: withOrgFilter(supabase.from('table').select('*'))
   */
  function withOrgFilter<T extends { eq: (column: string, value: string) => T }>(
    query: T
  ): T {
    if (!orgId) {
      console.warn('No organization selected, query may return no results')
      return query.eq('organization_id', 'no-org-selected')
    }
    return query.eq('organization_id', orgId)
  }
  
  /**
   * Get data with organization filter
   */
  async function select<T = any>(table: string, columns = '*') {
    if (!orgId) {
      return { data: null as T | null, error: new Error('No organization selected') }
    }
    
    return supabase
      .from(table)
      .select(columns)
      .eq('organization_id', orgId)
  }
  
  /**
   * Insert data with organization_id automatically added
   */
  async function insert<T = any>(table: string, data: Partial<T> | Partial<T>[]) {
    if (!orgId) {
      return { data: null, error: new Error('No organization selected') }
    }
    
    const dataWithOrg = Array.isArray(data)
      ? data.map(d => ({ ...d, organization_id: orgId }))
      : { ...data, organization_id: orgId }
    
    return supabase
      .from(table)
      .insert(dataWithOrg)
  }
  
  /**
   * Update data (organization_id filter automatically added)
   */
  async function update<T = any>(table: string, data: Partial<T>, matchColumn: string, matchValue: string) {
    if (!orgId) {
      return { data: null, error: new Error('No organization selected') }
    }
    
    return supabase
      .from(table)
      .update(data)
      .eq('organization_id', orgId)
      .eq(matchColumn, matchValue)
  }
  
  /**
   * Delete data (organization_id filter automatically added)
   */
  async function remove(table: string, matchColumn: string, matchValue: string) {
    if (!orgId) {
      return { data: null, error: new Error('No organization selected') }
    }
    
    return supabase
      .from(table)
      .delete()
      .eq('organization_id', orgId)
      .eq(matchColumn, matchValue)
  }
  
  return {
    orgId,
    hasOrg: !!orgId,
    withOrgFilter,
    select,
    insert,
    update,
    remove,
    // Direct supabase access when needed
    supabase,
  }
}

/**
 * Get organization ID for use in queries (non-hook version for use in callbacks)
 */
export function getOrgIdFromStorage(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('current_organization_id')
}
