// Database types based on our Supabase schema

// =====================================================
// MULTI-TENANT TYPES
// =====================================================

export type OrganizationRole = 'owner' | 'admin' | 'manager' | 'viewer'

export interface Organization {
  id: string
  name: string
  slug: string
  owner_id: string | null
  logo_url: string | null
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: OrganizationRole
  invited_by: string | null
  invited_at: string
  accepted_at: string | null
  created_at: string
  updated_at: string
}

export interface OrganizationMemberWithDetails extends OrganizationMember {
  organization?: Organization
  user?: {
    id: string
    email: string
  }
}

export interface Invitation {
  id: string
  organization_id: string
  email: string
  role: Exclude<OrganizationRole, 'owner'>
  token: string
  invited_by: string | null
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export interface InvitationWithOrg extends Invitation {
  organization?: Organization
}

export interface UserOrganization {
  organization_id: string
  organization_name: string
  organization_slug: string
  user_role: OrganizationRole
}

// =====================================================
// CORE TYPES (with organization_id)
// =====================================================

export interface Plantation {
  id: string
  organization_id: string | null
  name: string
  location: string
  area_hectares: number
  tea_variety: string
  number_of_plants: number | null
  established_date: string | null
  manager_id: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

export interface Worker {
  id: string
  organization_id: string | null
  employee_id: string
  first_name: string
  last_name: string
  phone: string | null
  role: 'picker' | 'supervisor' | 'manager' | 'quality_controller'
  plantation_id: string | null
  hire_date: string | null
  salary: number | null
  status: 'active' | 'inactive' | 'terminated'
  created_at: string
  updated_at: string
}

export interface HarvestRecord {
  id: string
  organization_id: string | null
  plantation_id: string
  worker_id: string
  harvest_date: string
  quantity_kg: number
  grade: 'A' | 'B' | 'C'
  weather_condition: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface QualityControl {
  id: string
  organization_id: string | null
  harvest_record_id: string
  inspector_id: string
  inspection_date: string
  moisture_content: number | null
  leaf_quality_score: number | null
  color_rating: string | null
  aroma_rating: string | null
  overall_grade: string | null
  defects_found: string[] | null
  approved: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Inventory {
  id: string
  organization_id: string | null
  plantation_id: string
  tea_type: string
  grade: 'A' | 'B' | 'C'
  quantity_kg: number
  unit_price: number | null
  storage_location: string | null
  expiry_date: string | null
  batch_number: string | null
  created_at: string
  updated_at: string
}

export interface Equipment {
  id: string
  organization_id: string | null
  plantation_id: string
  name: string
  type: string
  model: string | null
  purchase_date: string | null
  last_maintenance_date: string | null
  next_maintenance_date: string | null
  status: 'operational' | 'maintenance' | 'repair' | 'retired'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface WeatherData {
  id: string
  organization_id: string | null
  plantation_id: string
  record_date: string
  temperature_celsius: number | null
  humidity_percentage: number | null
  rainfall_mm: number | null
  wind_speed_kmh: number | null
  created_at: string
}

export interface SalesRecord {
  id: string
  organization_id: string | null
  plantation_id: string
  buyer_name: string
  buyer_contact: string | null
  sale_date: string
  tea_grade: 'A' | 'B' | 'C'
  quantity_kg: number
  unit_price: number
  total_amount: number
  payment_status: 'pending' | 'paid' | 'overdue'
  created_at: string
  updated_at: string
}

// =====================================================
// ADDITIONAL DATA TYPES (with organization_id)
// =====================================================

export interface DailyPlucking {
  id: string
  organization_id: string | null
  worker_id: string
  date: string
  kg_plucked: number
  rate_per_kg: number
  wage_earned: number
  total_income: number
  extra_work_payment: number
  is_advance: boolean
  notes: string | null
  created_at: string
}

export interface WorkerBonus {
  id: string
  organization_id: string | null
  worker_id: string
  month: string
  amount: number
  reason: string | null
  created_at: string
  updated_at: string
}

export interface SalaryPayment {
  id: string
  organization_id: string | null
  worker_id: string
  month: string
  amount: number
  paid_at: string
  created_at: string
}

export interface TeaSale {
  id: string
  organization_id: string | null
  date: string
  factory_id: string | null
  kg_delivered: number
  rate_per_kg: number
  total_income: number
  deductions: number
  net_income: number
  receipt_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface FactoryRate {
  id: string
  organization_id: string | null
  factory_name: string
  rate_per_kg: number
  effective_from: string
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RateHistory {
  id: string
  organization_id: string | null
  factory_id: string
  rate: number
  effective_date: string
  created_at: string
}

export interface ScheduleEvent {
  id: string
  organization_id: string | null
  title: string
  description: string | null
  date: string
  time: string | null
  type: string
  status: string
  created_at: string
  updated_at: string
}

// Extended types with relations
export interface WorkerWithPlantation extends Worker {
  plantation?: {
    id: string
    name: string
    location: string
  }
}

export interface HarvestRecordWithDetails extends HarvestRecord {
  plantation?: Plantation
  worker?: Worker
}

export interface HarvestRecordWithWorker extends HarvestRecord {
  worker?: {
    first_name: string
    last_name: string
  }
}

export interface HarvestRecordWithPlantation extends HarvestRecord {
  plantation?: {
    name: string
  }
}

// Partial plantation type for selections
export interface PlantationBasic {
  id: string
  name: string
  location: string
}

export interface QualityControlWithDetails extends QualityControl {
  harvest_record?: HarvestRecordWithDetails
  inspector?: Worker
}