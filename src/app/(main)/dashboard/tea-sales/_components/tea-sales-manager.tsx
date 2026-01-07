"use client"

import { useState, useEffect, useMemo } from "react"
import { Plus, Search, TrendingUp, Factory, Package, DollarSign, X, Save, Loader2, Calendar, Edit, Trash2, Download, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/data-table/data-table"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { ColumnDef } from "@tanstack/react-table"
import { useDataTableInstance } from "@/hooks/use-data-table-instance"
import { supabase } from "@/lib/supabase"
import { formatCurrency } from "@/lib/utils"
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import { toast } from "sonner"
import { useOrganization } from "@/contexts/organization-context"

interface TeaSale {
  id: string
  date: string
  factory_name: string
  kg_delivered: number
  rate_per_kg: number
  total_income: number
  notes?: string
}

interface FactoryRate {
  id: string
  factory_name: string
  current_rate: number
}

type FilterMode = "all" | "daily" | "monthly"

const SL_TIMEZONE = 'Asia/Colombo'

// Helper to get current date in Sri Lankan timezone as YYYY-MM-DD
function getSLDate() {
  return formatInTimeZone(new Date(), SL_TIMEZONE, 'yyyy-MM-dd')
}

// Helper to get current month in Sri Lankan timezone as YYYY-MM
function getSLMonth() {
  return formatInTimeZone(new Date(), SL_TIMEZONE, 'yyyy-MM')
}

// Helper to format date for display in Sri Lankan timezone
function formatSLDate(dateStr: string, formatStr: string = 'MMM dd, yyyy') {
  // Parse the date string and treat it as a local date (not UTC)
  const date = new Date(dateStr + 'T00:00:00')
  return format(date, formatStr)
}

export function TeaSalesManager() {
  const { currentOrganization, loading: orgLoading } = useOrganization()
  const orgId = currentOrganization?.organization_id
  
  const [teaSales, setTeaSales] = useState<TeaSale[]>([])
  const [factoryRates, setFactoryRates] = useState<FactoryRate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [editingSale, setEditingSale] = useState<TeaSale | null>(null)
  const [filterMode, setFilterMode] = useState<FilterMode>("monthly")
  const [selectedDate, setSelectedDate] = useState(getSLDate())
  const [selectedMonth, setSelectedMonth] = useState(getSLMonth())
  const [useCustomFactory, setUseCustomFactory] = useState(false)
  const [formData, setFormData] = useState({
    date: getSLDate(),
    factory_name: '',
    kg_delivered: '',
    rate_per_kg: '',
    notes: ''
  })

  useEffect(() => {
    if (orgId) {
      fetchTeaSalesData()
      fetchFactoryRates()
    }
  }, [orgId])

  async function fetchTeaSalesData() {
    if (!orgId) return
    try {
      const { data, error } = await supabase
        .from('tea_sales')
        .select('*')
        .eq('organization_id', orgId)
        .order('date', { ascending: false })

      if (error) {
        // Fallback if organization_id column doesn't exist
        if (error.message?.includes('organization_id') || error.code === '42703') {
          const { data: fallbackData } = await supabase
            .from('tea_sales')
            .select('*')
            .order('date', { ascending: false })
          setTeaSales(fallbackData || [])
          return
        }
        throw error
      }
      setTeaSales(data || [])
    } catch (error: any) {
      console.error('Error fetching tea sales:', error?.message || error)
      toast.error("Failed to load tea sales")
    } finally {
      setLoading(false)
    }
  }

  async function fetchFactoryRates() {
    if (!orgId) return
    try {
      const { data, error } = await supabase
        .from('factory_rates')
        .select('id, factory_name, current_rate')
        .eq('organization_id', orgId)
        .order('factory_name')

      if (error) {
        // Fallback if organization_id column doesn't exist
        if (error.message?.includes('organization_id') || error.code === '42703') {
          const { data: fallbackData } = await supabase
            .from('factory_rates')
            .select('id, factory_name, current_rate')
            .order('factory_name')
          setFactoryRates(fallbackData || [])
          return
        }
        throw error
      }
      setFactoryRates(data || [])
    } catch (error: any) {
      console.error('Error fetching factory rates:', error?.message || error)
    }
  }

  const handleFactorySelect = (factoryName: string) => {
    if (factoryName === '__custom__') {
      setUseCustomFactory(true)
      setFormData({ ...formData, factory_name: '', rate_per_kg: '' })
    } else {
      setUseCustomFactory(false)
      const factory = factoryRates.find(f => f.factory_name === factoryName)
      if (factory) {
        setFormData({
          ...formData,
          factory_name: factory.factory_name,
          rate_per_kg: factory.current_rate.toString()
        })
      }
    }
  }

  const handleEdit = (sale: TeaSale) => {
    setEditingSale(sale)
    setFormData({
      date: sale.date,
      factory_name: sale.factory_name,
      kg_delivered: sale.kg_delivered.toString(),
      rate_per_kg: sale.rate_per_kg.toString(),
      notes: sale.notes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (sale: TeaSale) => {
    if (!confirm(`Delete sale to ${sale.factory_name} on ${formatSLDate(sale.date)}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('tea_sales')
        .delete()
        .eq('id', sale.id)
      
      if (error) throw error
      
      setTeaSales(prev => prev.filter(s => s.id !== sale.id))
      toast.success("Sale deleted successfully")
    } catch (error: any) {
      console.error('Error deleting sale:', error)
      toast.error(error.message || "Failed to delete sale")
    }
  }

  async function syncFactoryRate(factoryName: string, rate: number, effectiveDate: string) {
    // Check if factory exists
    const existingFactory = factoryRates.find(f => f.factory_name === factoryName)
    
    if (existingFactory) {
      // Update if rate is different
      if (existingFactory.current_rate !== rate) {
        // Add to rate history
        await supabase
          .from('rate_history')
          .insert({
            factory_id: existingFactory.id,
            rate: rate,
            effective_date: effectiveDate
          })
        
        // Update factory rate
        await supabase
          .from('factory_rates')
          .update({
            current_rate: rate,
            previous_rate: existingFactory.current_rate,
            effective_date: effectiveDate
          })
          .eq('id', existingFactory.id)
        
        // Update local state
        setFactoryRates(prev => prev.map(f => 
          f.id === existingFactory.id ? { ...f, current_rate: rate } : f
        ))
      }
    } else {
      // Create new factory
      const { data: newFactory, error } = await supabase
        .from('factory_rates')
        .insert({
          factory_name: factoryName,
          current_rate: rate,
          effective_date: effectiveDate,
          organization_id: orgId
        })
        .select()
        .single()
      
      if (!error && newFactory) {
        // Add initial rate to history
        await supabase
          .from('rate_history')
          .insert({
            factory_id: newFactory.id,
            rate: rate,
            effective_date: effectiveDate
          })
        
        // Update local state
        setFactoryRates(prev => [...prev, { id: newFactory.id, factory_name: factoryName, current_rate: rate }])
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true)

    const kg = parseFloat(formData.kg_delivered)
    const rate = parseFloat(formData.rate_per_kg)
    const total = kg * rate

    const saleData = {
      date: formData.date,
      factory_name: formData.factory_name,
      kg_delivered: kg,
      rate_per_kg: rate,
      total_income: total,
      notes: formData.notes || undefined
    }

    try {
      // Sync factory rate (add new factory or update existing rate)
      await syncFactoryRate(formData.factory_name, rate, formData.date)

      if (editingSale) {
        const { error } = await supabase
          .from('tea_sales')
          .update(saleData)
          .eq('id', editingSale.id)
        
        if (error) throw error
        
        setTeaSales(prev => prev.map(s => 
          s.id === editingSale.id ? { ...s, ...saleData } : s
        ))
        toast.success("Sale updated successfully")
      } else {
        const { data, error } = await supabase
          .from('tea_sales')
          .insert({ ...saleData, organization_id: orgId })
          .select()
          .single()
        
        if (error) throw error
        
        setTeaSales(prev => [data, ...prev])
        toast.success("Sale recorded successfully")
      }

      setShowForm(false)
      setEditingSale(null)
      resetForm()
    } catch (error: any) {
      console.error('Error saving sale:', error)
      toast.error(error.message || "Failed to save sale")
    } finally {
      setFormLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      date: getSLDate(),
      factory_name: '',
      kg_delivered: '',
      rate_per_kg: '',
      notes: ''
    })
    setEditingSale(null)
    setUseCustomFactory(false)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    resetForm()
  }

  const handleOpenForm = () => {
    resetForm()
    setShowForm(true)
  }

  // Filter sales based on mode and selected date/month
  const filteredByDate = useMemo(() => {
    return teaSales.filter(sale => {
      const saleDate = parseISO(sale.date)
      
      if (filterMode === "daily") {
        const selected = parseISO(selectedDate)
        return isWithinInterval(saleDate, {
          start: startOfDay(selected),
          end: endOfDay(selected)
        })
      } else if (filterMode === "monthly") {
        const [year, month] = selectedMonth.split('-').map(Number)
        const monthStart = startOfMonth(new Date(year, month - 1))
        const monthEnd = endOfMonth(new Date(year, month - 1))
        return isWithinInterval(saleDate, { start: monthStart, end: monthEnd })
      }
      return true // "all" mode
    })
  }, [teaSales, filterMode, selectedDate, selectedMonth])

  // Apply search filter on top of date filter
  const filteredSales = useMemo(() => 
    filteredByDate.filter(sale =>
      sale.factory_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.date.includes(searchTerm)
    ), [filteredByDate, searchTerm]
  )

  // Calculate stats based on filtered data
  const stats = useMemo(() => {
    const totalKg = filteredByDate.reduce((sum, sale) => sum + sale.kg_delivered, 0)
    const totalIncome = filteredByDate.reduce((sum, sale) => sum + sale.total_income, 0)
    const factories = new Set(filteredByDate.map(sale => sale.factory_name)).size
    const avgRate = filteredByDate.length > 0 
      ? filteredByDate.reduce((sum, sale) => sum + sale.rate_per_kg, 0) / filteredByDate.length 
      : 0

    // Get breakdown by factory for daily view
    const factoryBreakdown = filteredByDate.reduce((acc, sale) => {
      if (!acc[sale.factory_name]) {
        acc[sale.factory_name] = { kg: 0, income: 0 }
      }
      acc[sale.factory_name].kg += sale.kg_delivered
      acc[sale.factory_name].income += sale.total_income
      return acc
    }, {} as Record<string, { kg: number; income: number }>)

    return { totalKg, totalIncome, factories, avgRate, factoryBreakdown }
  }, [filteredByDate])

  const columns: ColumnDef<TeaSale>[] = useMemo(() => [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => {
        const date = row.getValue("date") as string
        return formatSLDate(date)
      },
    },
    {
      accessorKey: "factory_name",
      header: "Factory",
    },
    {
      accessorKey: "kg_delivered",
      header: "KG Delivered",
      cell: ({ row }) => {
        const kg = row.getValue("kg_delivered") as number
        return <span className="font-medium">{kg.toFixed(1)} kg</span>
      },
    },
    {
      accessorKey: "rate_per_kg",
      header: "Rate/KG",
      cell: ({ row }) => {
        const rate = row.getValue("rate_per_kg") as number
        return <span>{formatCurrency(rate)}</span>
      },
    },
    {
      accessorKey: "total_income",
      header: "Total Income",
      cell: ({ row }) => {
        const income = row.getValue("total_income") as number
        return <span className="font-medium">{formatCurrency(income)}</span>
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const sale = row.original
        return (
          <div className="flex gap-1 justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => handleEdit(sale)}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => handleDelete(sale)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      },
    },
  ], [])

  const table = useDataTableInstance({
    data: filteredSales,
    columns,
    getRowId: (row) => row.id,
  })

  const getFilterLabel = () => {
    if (filterMode === "daily") {
      return formatSLDate(selectedDate, 'MMMM dd, yyyy')
    } else if (filterMode === "monthly") {
      const [year, month] = selectedMonth.split('-').map(Number)
      return format(new Date(year, month - 1), 'MMMM yyyy')
    }
    return "All Time"
  }

  // Export functions
  const exportToCSV = () => {
    if (filteredSales.length === 0) {
      toast.error("No data to export")
      return
    }

    const headers = ['Date', 'Factory', 'KG Delivered', 'Rate/KG', 'Total Income', 'Notes']
    const rows = filteredSales.map(sale => [
      format(parseISO(sale.date), 'yyyy-MM-dd'),
      sale.factory_name,
      sale.kg_delivered.toFixed(2),
      sale.rate_per_kg.toFixed(2),
      sale.total_income.toFixed(2),
      sale.notes || ''
    ])

    // Add summary row
    rows.push([])
    rows.push(['Summary'])
    rows.push(['Total KG', stats.totalKg.toFixed(2)])
    rows.push(['Total Income', stats.totalIncome.toFixed(2)])
    rows.push(['Average Rate/KG', stats.avgRate.toFixed(2)])
    rows.push(['Number of Factories', stats.factories.toString()])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `tea-sales-${getFilterLabel().replace(/\s+/g, '-').toLowerCase()}.csv`
    link.click()
    toast.success("Exported to CSV")
  }

  const exportToJSON = () => {
    if (filteredSales.length === 0) {
      toast.error("No data to export")
      return
    }

    const exportData = {
      period: getFilterLabel(),
      exportedAt: new Date().toISOString(),
      summary: {
        totalKg: stats.totalKg,
        totalIncome: stats.totalIncome,
        avgRate: stats.avgRate,
        factories: stats.factories
      },
      sales: filteredSales.map(sale => ({
        date: sale.date,
        factory: sale.factory_name,
        kgDelivered: sale.kg_delivered,
        ratePerKg: sale.rate_per_kg,
        totalIncome: sale.total_income,
        notes: sale.notes
      }))
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `tea-sales-${getFilterLabel().replace(/\s+/g, '-').toLowerCase()}.json`
    link.click()
    toast.success("Exported to JSON")
  }

  const printReport = () => {
    if (filteredSales.length === 0) {
      toast.error("No data to print")
      return
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error("Please allow popups for printing")
      return
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tea Sales Report - ${getFilterLabel()}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
          .summary-card { background: #f5f5f5; padding: 15px; border-radius: 8px; }
          .summary-card h3 { margin: 0; font-size: 12px; color: #666; }
          .summary-card p { margin: 5px 0 0; font-size: 18px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f5f5f5; font-weight: bold; }
          tr:nth-child(even) { background: #fafafa; }
          .total-row { font-weight: bold; background: #e8f5e9 !important; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Tea Sales Report</h1>
        <p><strong>Period:</strong> ${getFilterLabel()}</p>
        <p><strong>Generated:</strong> ${format(new Date(), 'MMMM dd, yyyy HH:mm')}</p>
        
        <div class="summary">
          <div class="summary-card">
            <h3>Total KG</h3>
            <p>${stats.totalKg.toFixed(1)} kg</p>
          </div>
          <div class="summary-card">
            <h3>Total Income</h3>
            <p>LKR ${stats.totalIncome.toLocaleString()}</p>
          </div>
          <div class="summary-card">
            <h3>Factories</h3>
            <p>${stats.factories}</p>
          </div>
          <div class="summary-card">
            <h3>Avg Rate/KG</h3>
            <p>LKR ${stats.avgRate.toFixed(2)}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Factory</th>
              <th>KG Delivered</th>
              <th>Rate/KG</th>
              <th>Total Income</th>
            </tr>
          </thead>
          <tbody>
            ${filteredSales.map(sale => `
              <tr>
                <td>${formatSLDate(sale.date)}</td>
                <td>${sale.factory_name}</td>
                <td>${sale.kg_delivered.toFixed(1)} kg</td>
                <td>LKR ${sale.rate_per_kg.toLocaleString()}</td>
                <td>LKR ${sale.total_income.toLocaleString()}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="2">Total</td>
              <td>${stats.totalKg.toFixed(1)} kg</td>
              <td>-</td>
              <td>LKR ${stats.totalIncome.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <p>Tea Plantation Dashboard - Sales Report</p>
        </div>

        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
  }

  if (orgLoading || !orgId) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading organization...</span>
      </div>
    )
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading tea sales...</div>
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        {/* Title and Add Button */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold">Tea Sales</h2>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToJSON}>
                  <Download className="h-4 w-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={printReport}>
                  <Download className="h-4 w-4 mr-2" />
                  Print Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          <Button onClick={handleOpenForm} size="sm" className="sm:size-default">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Record Sale</span>
          </Button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          {filterMode === "daily" && (
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-auto"
            />
          )}

          {filterMode === "monthly" && (
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full sm:w-auto"
            />
          )}

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sales..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
        </div>
      </div>

      {/* Period Label */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>Showing: <span className="font-medium text-foreground">{getFilterLabel()}</span></span>
      </div>

      {/* Stats Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-3 grid-cols-2 lg:grid-cols-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total KG</span>
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="text-lg font-bold mt-1">{stats.totalKg.toFixed(1)} kg</div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Income</span>
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="text-lg font-bold mt-1">{formatCurrency(stats.totalIncome)}</div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Factories</span>
            <Factory className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="text-lg font-bold mt-1">{stats.factories}</div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Avg Rate/KG</span>
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="text-lg font-bold mt-1">{formatCurrency(stats.avgRate)}</div>
        </Card>
      </div>

      {/* Factory Breakdown - Show for daily view */}
      {filterMode === "daily" && Object.keys(stats.factoryBreakdown).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Factory Breakdown</CardTitle>
            <CardDescription className="text-xs">Sales by factory for {formatSLDate(selectedDate, 'MMMM dd, yyyy')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.factoryBreakdown).map(([factory, data]) => (
                <div key={factory} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 bg-muted/50 rounded-md gap-1 sm:gap-4">
                  <span className="font-medium text-sm truncate">{factory}</span>
                  <div className="flex justify-between sm:justify-end gap-4 text-sm">
                    <span className="text-muted-foreground">{data.kg.toFixed(1)} kg</span>
                    <span className="font-medium">{formatCurrency(data.income)}</span>
                  </div>
                </div>
              ))}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 bg-primary/10 rounded-md border border-primary/20 gap-1 sm:gap-4">
                <span className="font-semibold text-sm">Day Total</span>
                <div className="flex justify-between sm:justify-end gap-4 text-sm">
                  <span className="text-muted-foreground">{stats.totalKg.toFixed(1)} kg</span>
                  <span className="font-bold">{formatCurrency(stats.totalIncome)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sales Records</CardTitle>
          <CardDescription className="text-xs">
            {filteredSales.length} {filteredSales.length === 1 ? 'sale' : 'sales'} found
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-[400px] overflow-auto rounded-md border">
            <DataTable table={table} columns={columns} />
          </div>
          <DataTablePagination table={table} />
        </CardContent>
      </Card>

      {filteredSales.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No sales found for this period</p>
        </div>
      )}

      {/* Add/Edit Sale Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{editingSale ? 'Edit Sale' : 'Record Sale'}</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCloseForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="date" className="text-xs">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      required
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Factory *</Label>
                    {!editingSale && !useCustomFactory ? (
                      <Select
                        value={formData.factory_name}
                        onValueChange={handleFactorySelect}
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue placeholder="Select factory" className="truncate" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-[200px] w-[var(--radix-select-trigger-width)] overflow-y-auto" sideOffset={4} align="start">
                          {factoryRates.map((factory) => (
                            <SelectItem key={factory.id} value={factory.factory_name}>
                              <span className="text-sm truncate">{factory.factory_name}</span>
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__">
                            <span className="text-muted-foreground text-sm">+ New factory</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex gap-1.5">
                        <Input
                          value={formData.factory_name}
                          onChange={(e) => setFormData({...formData, factory_name: e.target.value})}
                          placeholder="Factory name"
                          required
                          className="h-8 flex-1"
                        />
                        {!editingSale && (
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => {
                              setUseCustomFactory(false)
                              setFormData({...formData, factory_name: '', rate_per_kg: ''})
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="kg_delivered" className="text-xs">KG Delivered *</Label>
                    <Input
                      id="kg_delivered"
                      type="number"
                      step="0.1"
                      value={formData.kg_delivered}
                      onChange={(e) => setFormData({...formData, kg_delivered: e.target.value})}
                      placeholder="0.0"
                      required
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rate_per_kg" className="text-xs">Rate/KG (රු.) *</Label>
                    <Input
                      id="rate_per_kg"
                      type="number"
                      step="0.01"
                      value={formData.rate_per_kg}
                      onChange={(e) => setFormData({...formData, rate_per_kg: e.target.value})}
                      placeholder="0.00"
                      required
                      className="h-8"
                    />
                  </div>
                </div>

                {/* Calculated Total Preview */}
                {formData.kg_delivered && formData.rate_per_kg && (
                  <div className="p-2 bg-muted/50 rounded-md">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Total:</span>
                      <span className="font-bold">
                        {formatCurrency(parseFloat(formData.kg_delivered) * parseFloat(formData.rate_per_kg))}
                      </span>
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
                    {editingSale ? 'Update' : 'Save'}
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