"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Plus, Search, TrendingUp, TrendingDown, Factory, Edit, Trash2, X, Loader2, History, CalendarDays, SortAsc, ArrowDownAZ } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/data-table/data-table"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"

import { ColumnDef } from "@tanstack/react-table"
import { useDataTableInstance } from "@/hooks/use-data-table-instance"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { supabase } from "@/lib/supabase"
import { formatCurrency } from "@/lib/utils"
import { format, differenceInDays } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import { toast } from "sonner"
import { useOrganization } from "@/contexts/organization-context"

const SL_TIMEZONE = 'Asia/Colombo'

function getSLDate() {
  return formatInTimeZone(new Date(), SL_TIMEZONE, 'yyyy-MM-dd')
}

function formatSLDate(dateStr: string, formatStr: string = 'MMM dd, yyyy') {
  const date = new Date(dateStr + 'T00:00:00')
  return format(date, formatStr)
}

function getRelativeTime(dateStr: string) {
  const days = differenceInDays(new Date(), new Date(dateStr + 'T00:00:00'))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

interface FactoryRate {
  id: string
  factory_name: string
  current_rate: number
  previous_rate: number | null
  effective_date: string
  notes?: string
  created_at: string
  updated_at: string
}

interface RateHistory {
  id: string
  factory_id: string
  rate: number
  effective_date: string
  created_at: string
}

type SortOption = 'a-z' | 'z-a' | 'highest' | 'lowest' | 'newest' | 'oldest'

export function FactoryRatesManager() {
  const { currentOrganization, loading: orgLoading } = useOrganization()
  const orgId = currentOrganization?.organization_id
  
  const [factories, setFactories] = useState<FactoryRate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>('a-z')
  const [showForm, setShowForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedFactory, setSelectedFactory] = useState<FactoryRate | null>(null)
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [editingFactory, setEditingFactory] = useState<FactoryRate | null>(null)
  const [formData, setFormData] = useState({
    factory_name: '',
    current_rate: '',
    effective_date: getSLDate(),
    notes: ''
  })

  useEffect(() => {
    if (orgId) {
      fetchFactories()
    }
  }, [orgId])

  async function fetchFactories() {
    if (!orgId) return
    try {
      const { data, error } = await supabase
        .from('factory_rates')
        .select('*')
        .eq('organization_id', orgId)
        .order('factory_name')

      if (error) {
        // Fallback if organization_id column doesn't exist
        if (error.message?.includes('organization_id') || error.code === '42703') {
          const { data: fallbackData } = await supabase
            .from('factory_rates')
            .select('*')
            .order('factory_name')
          setFactories(fallbackData || [])
          return
        }
        throw error
      }
      setFactories(data || [])
    } catch (error: any) {
      console.error('Error fetching factories:', error?.message || error)
      toast.error("Failed to load factory rates")
    } finally {
      setLoading(false)
    }
  }

  async function fetchRateHistory(factoryId: string) {
    setHistoryLoading(true)
    try {
      const { data, error } = await supabase
        .from('rate_history')
        .select('*')
        .eq('factory_id', factoryId)
        .order('effective_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      setRateHistory(data || [])
    } catch (error) {
      console.error('Error fetching rate history:', error)
      toast.error("Failed to load rate history")
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleEdit = useCallback((factory: FactoryRate) => {
    setEditingFactory(factory)
    setFormData({
      factory_name: factory.factory_name,
      current_rate: factory.current_rate.toString(),
      effective_date: factory.effective_date,
      notes: factory.notes || ''
    })
    setShowForm(true)
  }, [])

  const handleViewHistory = useCallback(async (factory: FactoryRate) => {
    setSelectedFactory(factory)
    setShowHistory(true)
    await fetchRateHistory(factory.id)
  }, [])

  const handleDelete = useCallback(async (factory: FactoryRate) => {
    if (!confirm(`Delete ${factory.factory_name}? This will also delete all rate history.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('factory_rates')
        .delete()
        .eq('id', factory.id)
      
      if (error) throw error
      
      setFactories(prev => prev.filter(f => f.id !== factory.id))
      toast.success("Factory deleted successfully")
    } catch (error: any) {
      console.error('Error deleting factory:', error)
      toast.error(error.message || "Failed to delete factory")
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true)

    const rate = parseFloat(formData.current_rate)

    try {
      if (editingFactory) {
        const rateChanged = editingFactory.current_rate !== rate

        const updateData: any = {
          factory_name: formData.factory_name,
          current_rate: rate,
          effective_date: formData.effective_date,
          notes: formData.notes || null
        }

        if (rateChanged) {
          updateData.previous_rate = editingFactory.current_rate

          await supabase
            .from('rate_history')
            .insert({
              factory_id: editingFactory.id,
              rate: rate,
              effective_date: formData.effective_date
            })
        }

        const { error } = await supabase
          .from('factory_rates')
          .update(updateData)
          .eq('id', editingFactory.id)
        
        if (error) throw error
        
        toast.success("Factory rate updated successfully")
      } else {
        const { data, error } = await supabase
          .from('factory_rates')
          .insert({
            factory_name: formData.factory_name,
            current_rate: rate,
            effective_date: formData.effective_date,
            notes: formData.notes || null,
            organization_id: orgId
          })
          .select()
          .single()
        
        if (error) throw error

        await supabase
          .from('rate_history')
          .insert({
            factory_id: data.id,
            rate: rate,
            effective_date: formData.effective_date
          })
        
        toast.success("Factory added successfully")
      }

      setShowForm(false)
      setEditingFactory(null)
      resetForm()
      fetchFactories()
    } catch (error: any) {
      console.error('Error saving factory:', error)
      toast.error(error.message || "Failed to save factory")
    } finally {
      setFormLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      factory_name: '',
      current_rate: '',
      effective_date: getSLDate(),
      notes: ''
    })
    setEditingFactory(null)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    resetForm()
  }

  const filteredFactories = useMemo(() => {
    let result = factories.filter(factory =>
      factory.factory_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    
    // Apply sorting
    switch (sortBy) {
      case 'a-z':
        result = [...result].sort((a, b) => a.factory_name.localeCompare(b.factory_name))
        break
      case 'z-a':
        result = [...result].sort((a, b) => b.factory_name.localeCompare(a.factory_name))
        break
      case 'highest':
        result = [...result].sort((a, b) => b.current_rate - a.current_rate)
        break
      case 'lowest':
        result = [...result].sort((a, b) => a.current_rate - b.current_rate)
        break
      case 'newest':
        result = [...result].sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())
        break
      case 'oldest':
        result = [...result].sort((a, b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime())
        break
    }
    
    return result
  }, [factories, searchTerm, sortBy])

  // Calculate rate change for history entries
  const historyWithChanges = useMemo(() => {
    return rateHistory.map((entry, index) => {
      const nextEntry = rateHistory[index + 1]
      let change = null
      let changePercent = null
      
      if (nextEntry) {
        change = entry.rate - nextEntry.rate
        changePercent = (change / nextEntry.rate) * 100
      }
      
      return { ...entry, change, changePercent }
    })
  }, [rateHistory])

  const columns: ColumnDef<FactoryRate>[] = useMemo(() => [
    {
      accessorKey: "factory_name",
      header: "Factory Name",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.getValue("factory_name")}</span>
          {row.original.notes && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{row.original.notes}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "current_rate",
      header: "Current Rate",
      cell: ({ row }) => {
        const rate = row.getValue("current_rate") as number
        const previousRate = row.original.previous_rate
        const change = previousRate ? ((rate - previousRate) / previousRate) * 100 : null
        
        return (
          <div className="flex items-center gap-2">
            <span className="font-bold">{formatCurrency(rate)}/kg</span>
            {change !== null && (
              <Badge variant={change >= 0 ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                {change >= 0 ? <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                {Math.abs(change).toFixed(1)}%
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "previous_rate",
      header: "Previous",
      cell: ({ row }) => {
        const previousRate = row.getValue("previous_rate") as number | null
        return previousRate ? (
          <span className="text-muted-foreground">{formatCurrency(previousRate)}/kg</span>
        ) : (
          <span className="text-muted-foreground text-xs">First rate</span>
        )
      },
    },
    {
      accessorKey: "effective_date",
      header: "Updated",
      cell: ({ row }) => {
        const date = row.getValue("effective_date") as string
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-muted-foreground cursor-help flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {getRelativeTime(date)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{formatSLDate(date, 'EEEE, MMMM dd, yyyy')}</p>
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
        const factory = row.original
        return (
          <div className="flex gap-1 justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleViewHistory(factory)}
                  >
                    <History className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View rate history</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleEdit(factory)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit rate</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(factory)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete factory</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )
      },
    },
  ], [handleEdit, handleViewHistory, handleDelete])

  const table = useDataTableInstance({
    data: filteredFactories,
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
        <span className="text-sm text-muted-foreground">Loading factory rates...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold">Factory Rates</h2>
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Factory</span>
          </Button>
        </div>

        <div className="flex gap-2 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search factories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[130px] h-9">
              <SortAsc className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="a-z">
                <span className="flex items-center gap-1.5">
                  <ArrowDownAZ className="h-3.5 w-3.5" /> A-Z
                </span>
              </SelectItem>
              <SelectItem value="z-a">
                <span className="flex items-center gap-1.5">
                  <ArrowDownAZ className="h-3.5 w-3.5 rotate-180" /> Z-A
                </span>
              </SelectItem>
              <SelectItem value="highest">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Highest
                </span>
              </SelectItem>
              <SelectItem value="lowest">
                <span className="flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5" /> Lowest
                </span>
              </SelectItem>
              <SelectItem value="newest">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Newest
                </span>
              </SelectItem>
              <SelectItem value="oldest">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Oldest
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Factory Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Factory Rates</CardTitle>
          <CardDescription className="text-xs">
            {filteredFactories.length} {filteredFactories.length === 1 ? 'factory' : 'factories'}
            {searchTerm && ` matching "${searchTerm}"`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-[400px] overflow-auto rounded-md border">
            <DataTable table={table} columns={columns} />
          </div>
          <DataTablePagination table={table} />
        </CardContent>
      </Card>

      {filteredFactories.length === 0 && !loading && (
        <div className="text-center py-12">
          <Factory className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">
            {searchTerm ? `No factories matching "${searchTerm}"` : 'No factories found'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {searchTerm ? 'Try a different search term' : 'Add factories you sell tea to'}
          </p>
        </div>
      )}

      {/* Add/Edit Factory Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{editingFactory ? 'Update Rate' : 'Add Factory'}</CardTitle>
                  {editingFactory && (
                    <CardDescription className="text-xs">
                      Current: {formatCurrency(editingFactory.current_rate)}/kg
                    </CardDescription>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCloseForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="factory_name" className="text-xs">Factory Name *</Label>
                  <Input
                    id="factory_name"
                    value={formData.factory_name}
                    onChange={(e) => setFormData({...formData, factory_name: e.target.value})}
                    placeholder="e.g., Ceylon Tea Factory"
                    required
                    disabled={!!editingFactory}
                    className="h-8"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="current_rate" className="text-xs">Rate/KG (රු.) *</Label>
                    <Input
                      id="current_rate"
                      type="number"
                      step="0.01"
                      value={formData.current_rate}
                      onChange={(e) => setFormData({...formData, current_rate: e.target.value})}
                      placeholder="0.00"
                      required
                      className="h-8"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="effective_date" className="text-xs">Effective Date *</Label>
                    <Input
                      id="effective_date"
                      type="date"
                      value={formData.effective_date}
                      onChange={(e) => setFormData({...formData, effective_date: e.target.value})}
                      required
                      className="h-8"
                    />
                  </div>
                </div>

                {/* Show rate change preview when editing */}
                {editingFactory && formData.current_rate && parseFloat(formData.current_rate) !== editingFactory.current_rate && (
                  <div className="p-2 bg-muted/50 rounded-md">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Change:</span>
                      <div className="flex items-center gap-1">
                        {parseFloat(formData.current_rate) > editingFactory.current_rate ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <span className={parseFloat(formData.current_rate) > editingFactory.current_rate ? 'text-green-600' : 'text-red-600'}>
                          {((parseFloat(formData.current_rate) - editingFactory.current_rate) / editingFactory.current_rate * 100).toFixed(1)}%
                        </span>
                        <span className="text-muted-foreground">
                          ({formatCurrency(parseFloat(formData.current_rate) - editingFactory.current_rate)})
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-xs">Notes</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Optional notes"
                    className="h-8"
                  />
                </div>
                
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleCloseForm}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={formLoading}>
                    {formLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    {editingFactory ? 'Update' : 'Add'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rate History Modal */}
      {showHistory && selectedFactory && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm max-h-[70vh] overflow-hidden flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{selectedFactory.factory_name}</CardTitle>
                  <CardDescription className="text-xs">
                    {historyLoading ? 'Loading...' : `${rateHistory.length} rate ${rateHistory.length === 1 ? 'change' : 'changes'}`}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowHistory(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 pt-0">
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : historyWithChanges.length > 0 ? (
                <div className="space-y-1.5">
                  {historyWithChanges.map((entry, index) => {
                    const isCurrent = entry.rate === selectedFactory.current_rate && 
                      historyWithChanges.filter(e => e.rate === selectedFactory.current_rate).indexOf(entry) === 0
                    return (
                    <div key={entry.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(entry.rate)}/kg</span>
                        {isCurrent && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Current</Badge>
                        )}
                        {entry.changePercent !== null && (
                          <Badge 
                            variant={entry.change! >= 0 ? "default" : "destructive"} 
                            className="text-[10px] px-1.5 py-0"
                          >
                            {entry.change! >= 0 ? (
                              <TrendingUp className="h-2 w-2 mr-0.5" />
                            ) : (
                              <TrendingDown className="h-2 w-2 mr-0.5" />
                            )}
                            {Math.abs(entry.changePercent).toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatSLDate(entry.effective_date)}
                      </span>
                    </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-muted-foreground text-sm">No rate history</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
