"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Plus, Search, Users, Edit, Trash2, X, Loader2, Phone, CalendarDays, UserCircle } from "lucide-react"
import { useOrganization } from "@/contexts/organization-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { DataTable } from "@/components/data-table/data-table"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ColumnDef } from "@tanstack/react-table"
import { useDataTableInstance } from "@/hooks/use-data-table-instance"
import { supabase } from "@/lib/supabase"
import { format, differenceInYears, differenceInMonths, differenceInDays } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import { toast } from "sonner"

const SL_TIMEZONE = 'Asia/Colombo'

function getSLDate() {
  return formatInTimeZone(new Date(), SL_TIMEZONE, 'yyyy-MM-dd')
}

function formatSLDate(dateStr: string, formatStr: string = 'MMM dd, yyyy') {
  const date = new Date(dateStr + 'T00:00:00')
  return format(date, formatStr)
}

function getServiceDuration(hireDate: string) {
  const start = new Date(hireDate + 'T00:00:00')
  const now = new Date()
  const years = differenceInYears(now, start)
  const totalMonths = differenceInMonths(now, start)
  const months = totalMonths % 12
  const days = differenceInDays(now, start)
  
  if (years > 0) {
    return `${years}y ${months}m`
  }
  if (totalMonths > 0) {
    return `${totalMonths}m`
  }
  if (days > 0) {
    return `${days}d`
  }
  return 'Today'
}

interface Worker {
  id: string
  employee_id: string
  first_name: string
  last_name: string
  phone: string | null
  hire_date: string | null
  created_at: string
}

export function WorkersManager() {
  const { currentOrganization, loading: orgLoading } = useOrganization()
  const orgId = currentOrganization?.organization_id
  
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [formData, setFormData] = useState({
    employee_id: '',
    first_name: '',
    last_name: '',
    phone: '',
    hire_date: getSLDate()
  })

  useEffect(() => {
    if (orgId) {
      fetchWorkers()
    }
  }, [orgId])

  async function fetchWorkers() {
    if (!orgId) return
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('id, employee_id, first_name, last_name, phone, hire_date, created_at')
        .eq('organization_id', orgId)
        .order('first_name')

      if (error) {
        // Fallback if organization_id column doesn't exist
        if (error.message?.includes('organization_id') || error.code === '42703') {
          console.warn('organization_id column not found - run the database migration')
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('workers')
            .select('id, employee_id, first_name, last_name, phone, hire_date, created_at')
            .order('first_name')
          
          if (fallbackError) throw fallbackError
          setWorkers(fallbackData || [])
          return
        }
        throw error
      }
      setWorkers(data || [])
    } catch (error: any) {
      console.error('Error fetching workers:', error?.message || error)
      toast.error("Failed to load workers")
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = useCallback((worker: Worker) => {
    setEditingWorker(worker)
    setFormData({
      employee_id: worker.employee_id,
      first_name: worker.first_name,
      last_name: worker.last_name,
      phone: worker.phone || '',
      hire_date: worker.hire_date || getSLDate()
    })
    setShowForm(true)
  }, [])

  const handleDelete = useCallback(async (worker: Worker) => {
    if (!confirm(`Delete ${worker.first_name} ${worker.last_name}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('workers')
        .delete()
        .eq('id', worker.id)
      
      if (error) throw error
      
      setWorkers(prev => prev.filter(w => w.id !== worker.id))
      toast.success("Worker deleted successfully")
    } catch (error: any) {
      console.error('Error deleting worker:', error)
      toast.error(error.message || "Failed to delete worker")
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true)

    const workerData = {
      employee_id: formData.employee_id,
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone: formData.phone || null,
      hire_date: formData.hire_date || null
    }

    try {
      if (editingWorker) {
        const { error } = await supabase
          .from('workers')
          .update(workerData)
          .eq('id', editingWorker.id)
        
        if (error) throw error
        toast.success("Worker updated successfully")
      } else {
        const { error } = await supabase
          .from('workers')
          .insert({ ...workerData, organization_id: orgId })
        
        if (error) throw error
        toast.success("Worker added successfully")
      }

      setShowForm(false)
      setEditingWorker(null)
      resetForm()
      fetchWorkers()
    } catch (error: any) {
      console.error('Error saving worker:', error)
      toast.error(error.message || "Failed to save worker")
    } finally {
      setFormLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      employee_id: '',
      first_name: '',
      last_name: '',
      phone: '',
      hire_date: getSLDate()
    })
    setEditingWorker(null)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    resetForm()
  }

  const filteredWorkers = useMemo(() => 
    workers.filter(worker =>
      worker.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (worker.phone && worker.phone.includes(searchTerm))
    ), [workers, searchTerm]
  )

  const stats = useMemo(() => {
    const total = workers.length
    const withPhone = workers.filter(w => w.phone).length
    
    return { total, withPhone }
  }, [workers])

  // Generate next employee ID
  const generateNextEmployeeId = useCallback(() => {
    const prefix = 'EMP'
    const existingNumbers = workers
      .map(w => {
        const match = w.employee_id.match(/^EMP(\d+)$/i)
        return match ? parseInt(match[1], 10) : 0
      })
      .filter(n => !isNaN(n))
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0
    const nextNumber = maxNumber + 1
    return `${prefix}${String(nextNumber).padStart(3, '0')}`
  }, [workers])

  const columns: ColumnDef<Worker>[] = useMemo(() => [
    {
      accessorKey: "employee_id",
      header: "ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.getValue("employee_id")}</span>
      ),
    },
    {
      id: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <UserCircle className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{row.original.first_name} {row.original.last_name}</span>
        </div>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => {
        const phone = row.getValue("phone") as string | null
        return phone ? (
          <span className="flex items-center gap-1.5 text-sm">
            <Phone className="h-3 w-3 text-muted-foreground" />
            {phone}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
      },
    },
    {
      accessorKey: "hire_date",
      header: "Hired",
      cell: ({ row }) => {
        const hireDate = row.getValue("hire_date") as string | null
        if (!hireDate) return <span className="text-muted-foreground text-xs">-</span>
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-muted-foreground cursor-help flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {getServiceDuration(hireDate)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Hired on {formatSLDate(hireDate, 'MMMM dd, yyyy')}</p>
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
        const worker = row.original
        return (
          <div className="flex gap-1 justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleEdit(worker)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit worker</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(worker)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete worker</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )
      },
    },
  ], [handleEdit, handleDelete])

  const table = useDataTableInstance({
    data: filteredWorkers,
    columns,
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
        <span className="text-sm text-muted-foreground">Loading workers...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold">Workers</h2>
          <Button onClick={() => {
            setFormData(prev => ({ ...prev, employee_id: generateNextEmployeeId() }))
            setShowForm(true)
          }} size="sm">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Worker</span>
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>


      {/* Workers Table */}
      <Card>
        <CardContent className="space-y-4">
          <div className="max-h-[400px] overflow-auto rounded-md border">
            <DataTable table={table} columns={columns} />
          </div>
          <DataTablePagination table={table} />
        </CardContent>
      </Card>

      {filteredWorkers.length === 0 && !loading && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">
            {searchTerm ? `No workers matching "${searchTerm}"` : 'No workers found'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {searchTerm ? 'Try a different search term' : 'Add workers to your team'}
          </p>
        </div>
      )}

      {/* Add/Edit Worker Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{editingWorker ? 'Edit Worker' : 'Add Worker'}</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCloseForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="employee_id" className="text-xs">Employee ID *</Label>
                  <Input
                    id="employee_id"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
                    placeholder="e.g., EMP001"
                    required
                    className="h-8"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name" className="text-xs">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                      placeholder="Saman"
                      required
                      className="h-8"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="last_name" className="text-xs">Last Name</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                      placeholder="Perera"
                      className="h-8"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="+94 77 123 4567"
                      className="h-8"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="hire_date" className="text-xs">Hire Date</Label>
                    <Input
                      id="hire_date"
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) => setFormData({...formData, hire_date: e.target.value})}
                      className="h-8"
                    />
                  </div>
                </div>
                
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleCloseForm}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={formLoading}>
                    {formLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    {editingWorker ? 'Update' : 'Add'}
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