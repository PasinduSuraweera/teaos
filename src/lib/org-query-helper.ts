/**
 * Helper to handle queries that may fail if organization_id column doesn't exist yet
 * This provides graceful fallback until the database migration is run
 */

import { supabase } from '@/lib/supabase'

interface QueryOptions {
  table: string
  select?: string
  orgId: string | undefined
  orderBy?: string
  ascending?: boolean
  filters?: Array<{ column: string; value: any; operator?: 'eq' | 'gte' | 'lte' | 'gt' | 'lt' }>
}

export async function queryWithOrgFallback<T = any>({
  table,
  select = '*',
  orgId,
  orderBy,
  ascending = true,
  filters = []
}: QueryOptions): Promise<{ data: T[] | null; error: any }> {
  if (!orgId) {
    return { data: null, error: new Error('No organization selected') }
  }

  try {
    let query = supabase.from(table).select(select)
    
    // Apply organization filter
    query = query.eq('organization_id', orgId)
    
    // Apply additional filters
    for (const filter of filters) {
      const op = filter.operator || 'eq'
      switch (op) {
        case 'gte':
          query = query.gte(filter.column, filter.value)
          break
        case 'lte':
          query = query.lte(filter.column, filter.value)
          break
        case 'gt':
          query = query.gt(filter.column, filter.value)
          break
        case 'lt':
          query = query.lt(filter.column, filter.value)
          break
        default:
          query = query.eq(filter.column, filter.value)
      }
    }
    
    // Apply ordering
    if (orderBy) {
      query = query.order(orderBy, { ascending })
    }
    
    const { data, error } = await query
    
    if (error) {
      // Check if error is due to missing organization_id column
      if (error.message?.includes('organization_id') || error.code === '42703') {
        console.warn(`organization_id column not found in ${table} - run the database migration`)
        
        // Retry without organization filter
        let fallbackQuery = supabase.from(table).select(select)
        
        for (const filter of filters) {
          const op = filter.operator || 'eq'
          switch (op) {
            case 'gte':
              fallbackQuery = fallbackQuery.gte(filter.column, filter.value)
              break
            case 'lte':
              fallbackQuery = fallbackQuery.lte(filter.column, filter.value)
              break
            case 'gt':
              fallbackQuery = fallbackQuery.gt(filter.column, filter.value)
              break
            case 'lt':
              fallbackQuery = fallbackQuery.lt(filter.column, filter.value)
              break
            default:
              fallbackQuery = fallbackQuery.eq(filter.column, filter.value)
          }
        }
        
        if (orderBy) {
          fallbackQuery = fallbackQuery.order(orderBy, { ascending })
        }
        
        const fallbackResult = await fallbackQuery
        return { data: fallbackResult.data as T[] | null, error: fallbackResult.error }
      }
      
      return { data: null, error }
    }
    
    return { data: data as T[], error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Check if organization tables exist
 */
export async function checkMigrationStatus(): Promise<{
  organizationsExists: boolean
  membersExists: boolean
  invitationsExists: boolean
  orgColumnExists: boolean
}> {
  const results = {
    organizationsExists: false,
    membersExists: false,
    invitationsExists: false,
    orgColumnExists: false,
  }

  try {
    // Check organizations table
    const { error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
    results.organizationsExists = !orgError

    // Check organization_members table
    const { error: membersError } = await supabase
      .from('organization_members')
      .select('id')
      .limit(1)
    results.membersExists = !membersError

    // Check invitations table
    const { error: invError } = await supabase
      .from('invitations')
      .select('id')
      .limit(1)
    results.invitationsExists = !invError

    // Check if organization_id column exists on workers table
    const { error: colError } = await supabase
      .from('workers')
      .select('organization_id')
      .limit(1)
    results.orgColumnExists = !colError
  } catch (err) {
    console.error('Error checking migration status:', err)
  }

  return results
}
