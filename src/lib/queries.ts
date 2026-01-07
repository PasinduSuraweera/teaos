import { supabase } from './supabase'
import type { 
  Plantation, 
  Worker, 
  HarvestRecord, 
  QualityControl, 
  Inventory,
  WeatherData,
  SalesRecord 
} from '@/types/database'

// Plantation queries
export const plantationQueries = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('plantations')
      .select('*')
      .order('name')
    
    if (error) throw error
    return data as Plantation[]
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('plantations')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data as Plantation
  },

  getStats: async () => {
    const { count, error } = await supabase
      .from('plantations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
    
    if (error) throw error
    return { totalPlantations: count || 0 }
  }
}

// Worker queries
export const workerQueries = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('workers')
      .select(`
        *,
        plantation:plantations(name)
      `)
      .order('last_name')
    
    if (error) throw error
    return data as Worker[]
  },

  getStats: async () => {
    const { count, error } = await supabase
      .from('workers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
    
    if (error) throw error
    return { activeWorkers: count || 0 }
  }
}

// Harvest queries
export const harvestQueries = {
  getRecent: async (limit: number = 10) => {
    const { data, error } = await supabase
      .from('harvest_records')
      .select(`
        *,
        plantation:plantations(name),
        worker:workers(first_name, last_name)
      `)
      .order('harvest_date', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data as HarvestRecord[]
  },

  getTodaysTotal: async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('harvest_records')
      .select('quantity_kg')
      .eq('harvest_date', today)
    
    if (error) throw error
    const total = data.reduce((sum, record) => sum + record.quantity_kg, 0)
    return { todaysHarvest: total }
  },

  getWeeklyTrends: async () => {
    const { data, error } = await supabase
      .from('harvest_records')
      .select('harvest_date, quantity_kg, grade')
      .gte('harvest_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('harvest_date')
    
    if (error) throw error
    return data
  }
}

// Quality Control queries
export const qualityQueries = {
  getRecent: async (limit: number = 10) => {
    const { data, error } = await supabase
      .from('quality_control')
      .select(`
        *,
        harvest_record:harvest_records(*),
        inspector:workers(first_name, last_name)
      `)
      .order('inspection_date', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data as QualityControl[]
  }
}

// Inventory queries
export const inventoryQueries = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select(`
        *,
        plantation:plantations(name)
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data as Inventory[]
  }
}

// Weather queries
export const weatherQueries = {
  getRecent: async (plantationId?: string, days: number = 7) => {
    let query = supabase
      .from('weather_data')
      .select('*')
      .gte('record_date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('record_date', { ascending: false })
    
    if (plantationId) {
      query = query.eq('plantation_id', plantationId)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data as WeatherData[]
  }
}

// Sales queries
export const salesQueries = {
  getMonthlyRevenue: async () => {
    const firstDayOfMonth = new Date()
    firstDayOfMonth.setDate(1)
    
    const { data, error } = await supabase
      .from('sales_records')
      .select('total_amount')
      .gte('sale_date', firstDayOfMonth.toISOString().split('T')[0])
    
    if (error) throw error
    const total = data.reduce((sum, sale) => sum + sale.total_amount, 0)
    return { monthlyRevenue: total }
  },

  getRecent: async (limit: number = 10) => {
    const { data, error } = await supabase
      .from('sales_records')
      .select(`
        *,
        plantation:plantations(name)
      `)
      .order('sale_date', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data as SalesRecord[]
  }
}