"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Search, Users, TrendingUp, CalendarDays, Download, Printer, Banknote, Leaf, MinusCircle, Gift, ChevronLeft, ChevronRight, Loader2, Edit, Check, X, CheckCircle, Circle } from "lucide-react"
import { useOrganization } from "@/contexts/organization-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/data-table/data-table"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ColumnDef } from "@tanstack/react-table"
import { useDataTableInstance } from "@/hooks/use-data-table-instance"
import { supabase } from "@/lib/supabase"
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"

interface WorkerSalary {
  worker_id: string
  employee_id: string
  worker_name: string
  total_kg: number
  total_earned: number
  bonus: number
  bonus_id: string | null
  total_advance: number
  net_salary: number
  days_worked: number
  avg_kg_per_day: number
  is_paid: boolean
  payment_id: string | null
}

export function SalaryManager() {
  const { currentOrganization, loading: orgLoading } = useOrganization()
  const orgId = currentOrganization?.organization_id
  
  const [salaries, setSalaries] = useState<WorkerSalary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()))
  const [editingBonusId, setEditingBonusId] = useState<string | null>(null)
  const [bonusValue, setBonusValue] = useState("")
  const [savingBonus, setSavingBonus] = useState(false)
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null)

  useEffect(() => {
    if (orgId) {
      fetchSalaryData()
    }
  }, [selectedMonth, orgId])

  async function fetchSalaryData() {
    if (!orgId) return
    setLoading(true)
    try {
      const monthStart = format(selectedMonth, 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd')

      // Fetch all daily plucking records for the selected month
      let records: any[] = []
      const { data, error } = await supabase
        .from('daily_plucking')
        .select(`
          id,
          worker_id,
          date,
          kg_plucked,
          rate_per_kg,
          wage_earned,
          is_advance,
          extra_work_payment,
          workers!inner (
            id,
            employee_id,
            first_name,
            last_name
          )
        `)
        .eq('organization_id', orgId)
        .gte('date', monthStart)
        .lte('date', monthEnd)

      if (error) {
        // Fallback if organization_id column doesn't exist
        if (error.message?.includes('organization_id') || error.code === '42703') {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('daily_plucking')
            .select(`
              id,
              worker_id,
              date,
              kg_plucked,
              rate_per_kg,
              wage_earned,
              is_advance,
              extra_work_payment,
              workers!inner (
                id,
                employee_id,
                first_name,
                last_name
              )
            `)
            .gte('date', monthStart)
            .lte('date', monthEnd)
          
          if (fallbackError) {
            if (fallbackError.message?.includes('relation "daily_plucking" does not exist')) {
              toast.error("Daily plucking table not found. Please run the SQL setup.")
              setSalaries([])
              return
            }
            throw fallbackError
          }
          records = fallbackData || []
        } else if (error.message?.includes('relation "daily_plucking" does not exist')) {
          toast.error("Daily plucking table not found. Please run the SQL setup.")
          setSalaries([])
          return
        } else {
          throw error
        }
      } else {
        records = data || []
      }

      // Fetch bonuses for this month
      let bonuses: any[] = []
      const { data: bonusData, error: bonusError } = await supabase
        .from('worker_bonuses')
        .select(`
          *,
          workers!inner (
            id,
            employee_id,
            first_name,
            last_name
          )
        `)
        .eq('organization_id', orgId)
        .eq('month', monthStart)

      if (bonusError) {
        // Fallback if organization_id column doesn't exist
        if (bonusError.message?.includes('organization_id') || bonusError.code === '42703') {
          const { data: fallbackBonuses } = await supabase
            .from('worker_bonuses')
            .select(`
              *,
              workers!inner (
                id,
                employee_id,
                first_name,
                last_name
              )
            `)
            .eq('month', monthStart)
          bonuses = fallbackBonuses || []
        }
      } else {
        bonuses = bonusData || []
      }

      // Create bonus map (ignore error if table doesn't exist)
      const bonusMap = new Map<string, { id: string, amount: number }>()
      if (!bonusError && bonuses) {
        bonuses.forEach((b: any) => {
          bonusMap.set(b.worker_id, { id: b.id, amount: b.amount })
        })
      }

      // Fetch payment records for this month
      const { data: payments, error: paymentError } = await supabase
        .from('salary_payments')
        .select('*')
        .eq('organization_id', orgId)
        .eq('month', monthStart)

      // Create payment map (ignore error if table doesn't exist)
      const paymentMap = new Map<string, string>()
      if (!paymentError && payments) {
        payments.forEach((p: any) => {
          paymentMap.set(p.worker_id, p.id)
        })
      }

      // Process records to calculate salary per worker
      const workerMap = new Map<string, WorkerSalary>()
      const workerDates = new Map<string, Set<string>>() // Track unique dates per worker

      records?.forEach((record: any) => {
        const workerId = record.worker_id
        const worker = record.workers
        const workerName = `${worker.first_name}${worker.last_name ? ' ' + worker.last_name : ''}`
        
        if (!workerMap.has(workerId)) {
          const bonusData = bonusMap.get(workerId)
          const paymentId = paymentMap.get(workerId)
          workerMap.set(workerId, {
            worker_id: workerId,
            employee_id: worker.employee_id,
            worker_name: workerName,
            total_kg: 0,
            total_earned: 0,
            bonus: bonusData?.amount || 0,
            bonus_id: bonusData?.id || null,
            total_advance: 0,
            net_salary: 0,
            days_worked: 0,
            avg_kg_per_day: 0,
            is_paid: !!paymentId,
            payment_id: paymentId || null
          })
          workerDates.set(workerId, new Set<string>())
        }

        const workerData = workerMap.get(workerId)!
        
        if (record.is_advance) {
          // Advance payment (stored as negative)
          workerData.total_advance += Math.abs(record.wage_earned)
        } else {
          // Regular plucking + extra work
          workerData.total_kg += record.kg_plucked
          const pluckingAmount = record.kg_plucked * record.rate_per_kg
          const extraWorkAmount = record.extra_work_payment || 0
          workerData.total_earned += pluckingAmount + extraWorkAmount
          
          // Add date to the set (only counts unique dates)
          workerDates.get(workerId)!.add(record.date)
        }
      })

      // Add workers who have bonuses but no plucking records
      if (!bonusError && bonuses) {
        bonuses.forEach((bonus: any) => {
          const workerId = bonus.worker_id
          if (!workerMap.has(workerId)) {
            const worker = bonus.workers
            const workerName = `${worker.first_name}${worker.last_name ? ' ' + worker.last_name : ''}`
            const paymentId = paymentMap.get(workerId)
            
            workerMap.set(workerId, {
              worker_id: workerId,
              employee_id: worker.employee_id,
              worker_name: workerName,
              total_kg: 0,
              total_earned: 0,
              bonus: bonus.amount || 0,
              bonus_id: bonus.id || null,
              total_advance: 0,
              net_salary: 0,
              days_worked: 0,
              avg_kg_per_day: 0,
              is_paid: !!paymentId,
              payment_id: paymentId || null
            })
            workerDates.set(workerId, new Set<string>())
          }
        })
      }

      // Calculate net salary and averages, using unique date count for days worked
      const salaryList = Array.from(workerMap.values()).map(w => {
        const daysWorked = workerDates.get(w.worker_id)?.size || 0
        return {
          ...w,
          days_worked: daysWorked,
          net_salary: w.total_earned + w.bonus - w.total_advance,
          avg_kg_per_day: daysWorked > 0 ? w.total_kg / daysWorked : 0
        }
      })

      // Sort by net salary descending
      salaryList.sort((a, b) => b.net_salary - a.net_salary)

      setSalaries(salaryList)
    } catch (error) {
      console.error('Error fetching salary data:', error)
      toast.error("Failed to load salary data")
    } finally {
      setLoading(false)
    }
  }

  const handlePreviousMonth = () => {
    setSelectedMonth(prev => subMonths(prev, 1))
  }

  const handleNextMonth = () => {
    const nextMonth = addMonths(selectedMonth, 1)
    if (nextMonth <= new Date()) {
      setSelectedMonth(nextMonth)
    }
  }

  const handleEditBonus = useCallback((workerId: string, currentBonus: number) => {
    setEditingBonusId(workerId)
    setBonusValue(currentBonus > 0 ? currentBonus.toString() : '')
  }, [])

  const handleCancelBonus = useCallback(() => {
    setEditingBonusId(null)
    setBonusValue('')
  }, [])

  const handleSaveBonus = useCallback(async (workerId: string, bonusId: string | null) => {
    setSavingBonus(true)
    const monthStart = format(selectedMonth, 'yyyy-MM-dd')
    const amount = parseFloat(bonusValue) || 0

    try {
      if (bonusId) {
        // Update existing bonus
        if (amount > 0) {
          const { error } = await supabase
            .from('worker_bonuses')
            .update({ amount })
            .eq('id', bonusId)
          if (error) throw error
        } else {
          // Delete if amount is 0
          const { error } = await supabase
            .from('worker_bonuses')
            .delete()
            .eq('id', bonusId)
          if (error) throw error
        }
      } else if (amount > 0) {
        // Insert new bonus
        const { error } = await supabase
          .from('worker_bonuses')
          .insert({
            worker_id: workerId,
            month: monthStart,
            amount,
            organization_id: orgId
          })
        if (error) throw error
      }

      toast.success("Bonus updated")
      setEditingBonusId(null)
      setBonusValue('')
      fetchSalaryData()
    } catch (error: any) {
      console.error('Error saving bonus:', error)
      if (error.message?.includes('worker_bonuses')) {
        toast.error("Bonus table not found. Please run the SQL setup.")
      } else {
        toast.error(error.message || "Failed to save bonus")
      }
    } finally {
      setSavingBonus(false)
    }
  }, [bonusValue, selectedMonth])

  const handleTogglePaid = useCallback(async (workerId: string, paymentId: string | null, isPaid: boolean) => {
    setMarkingPaidId(workerId)
    const monthStart = format(selectedMonth, 'yyyy-MM-dd')

    try {
      if (isPaid && paymentId) {
        // Unmark as paid - delete the payment record
        const { error } = await supabase
          .from('salary_payments')
          .delete()
          .eq('id', paymentId)
        if (error) throw error
        toast.success("Marked as unpaid")
      } else {
        // Mark as paid - insert payment record
        const { error } = await supabase
          .from('salary_payments')
          .insert({
            worker_id: workerId,
            month: monthStart,
            paid_at: new Date().toISOString(),
            organization_id: orgId
          })
        if (error) throw error
        toast.success("Marked as paid")
      }
      fetchSalaryData()
    } catch (error: any) {
      console.error('Error toggling payment:', error)
      if (error.message?.includes('salary_payments')) {
        toast.error("Payment table not found. Please run the SQL setup.")
      } else {
        toast.error(error.message || "Failed to update payment status")
      }
    } finally {
      setMarkingPaidId(null)
    }
  }, [selectedMonth])

  const filteredSalaries = useMemo(() =>
    salaries.filter(salary =>
      salary.worker_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      salary.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
    ), [salaries, searchTerm]
  )

  const stats = useMemo(() => {
    const totalPaid = salaries.reduce((sum, s) => sum + s.net_salary, 0)
    const actuallyPaid = salaries.filter(s => s.is_paid).reduce((sum, s) => sum + s.net_salary, 0)
    const totalKg = salaries.reduce((sum, s) => sum + s.total_kg, 0)
    const totalWorkers = salaries.length
    const paidWorkers = salaries.filter(s => s.is_paid).length
    const totalBonus = salaries.reduce((sum, s) => sum + s.bonus, 0)

    return { totalPaid, actuallyPaid, totalKg, totalWorkers, paidWorkers, totalBonus }
  }, [salaries])

  // Export functions
  const exportToCSV = () => {
    const headers = ["Employee ID", "Worker Name", "Days Worked", "Total Kg", "Avg Kg/Day", "Total", "Bonus", "Advances", "Net Salary"]
    const rows = filteredSalaries.map(salary => [
      salary.employee_id,
      salary.worker_name,
      salary.days_worked,
      salary.total_kg.toFixed(1),
      salary.avg_kg_per_day.toFixed(1),
      salary.total_earned.toFixed(2),
      salary.bonus.toFixed(2),
      salary.total_advance.toFixed(2),
      salary.net_salary.toFixed(2)
    ])
    
    const csvContent = [
      `Salary Report - ${format(selectedMonth, 'MMMM yyyy')}`,
      "",
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")
    
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `salary-report-${format(selectedMonth, 'yyyy-MM')}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Exported to CSV")
  }

  const exportToJSON = () => {
    const data = {
      month: format(selectedMonth, 'MMMM yyyy'),
      generated_at: new Date().toISOString(),
      summary: stats,
      workers: filteredSalaries.map(salary => ({
        employee_id: salary.employee_id,
        worker_name: salary.worker_name,
        days_worked: salary.days_worked,
        total_kg: salary.total_kg,
        avg_kg_per_day: salary.avg_kg_per_day,
        total_earned: salary.total_earned,
        bonus: salary.bonus,
        total_advance: salary.total_advance,
        net_salary: salary.net_salary
      }))
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `salary-report-${format(selectedMonth, 'yyyy-MM')}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Exported to JSON")
  }

  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>Salary Report - ${format(selectedMonth, 'MMMM yyyy')}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 18px; margin-bottom: 5px; }
            .subtitle { color: #666; font-size: 12px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
            .number { text-align: right; }
            .positive { color: #16a34a; }
            .negative { color: #dc2626; }
            .summary { margin-top: 20px; font-size: 13px; }
            .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px; }
            .summary-item { background: #f9f9f9; padding: 10px; border-radius: 4px; }
            .summary-label { font-size: 10px; color: #666; }
            .summary-value { font-size: 16px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Salary Report</h1>
          <div class="subtitle">${format(selectedMonth, 'MMMM yyyy')} • ${salaries.length} Workers</div>
          
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Worker</th>
                <th class="number">Days</th>
                <th class="number">Total Kg</th>
                <th class="number">Avg/Day</th>
                <th class="number">Total</th>
                <th class="number">Bonus</th>
                <th class="number">Advances</th>
                <th class="number">Net Salary</th>
              </tr>
            </thead>
            <tbody>
              ${filteredSalaries.map(salary => `
                <tr>
                  <td>${salary.employee_id}</td>
                  <td>${salary.worker_name}</td>
                  <td class="number">${salary.days_worked}</td>
                  <td class="number">${salary.total_kg.toFixed(1)} kg</td>
                  <td class="number">${salary.avg_kg_per_day.toFixed(1)} kg</td>
                  <td class="number">${formatCurrency(salary.total_earned)}</td>
                  <td class="number positive">${formatCurrency(salary.bonus)}</td>
                  <td class="number negative">${formatCurrency(salary.total_advance)}</td>
                  <td class="number" style="font-weight: bold;">${formatCurrency(salary.net_salary)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary">
            <strong>Summary</strong>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Total Workers</div>
                <div class="summary-value">${stats.totalWorkers}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Total Kg</div>
                <div class="summary-value">${stats.totalKg.toFixed(1)} kg</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Total Bonus</div>
                <div class="summary-value">${formatCurrency(stats.totalBonus)}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Total Paid</div>
                <div class="summary-value">${formatCurrency(stats.totalPaid)}</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const columns: ColumnDef<WorkerSalary>[] = useMemo(() => [
    {
      accessorKey: "employee_id",
      header: "ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.getValue("employee_id")}</span>
      ),
    },
    {
      accessorKey: "worker_name",
      header: "Worker",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("worker_name")}</span>
      ),
    },
    {
      accessorKey: "days_worked",
      header: "Days",
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue("days_worked")}</span>
      ),
    },
    {
      accessorKey: "total_kg",
      header: "Total Kg",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Leaf className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{row.getValue<number>("total_kg").toFixed(1)} kg</span>
        </div>
      ),
    },
    {
      accessorKey: "avg_kg_per_day",
      header: "Avg/Day",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.getValue<number>("avg_kg_per_day").toFixed(1)} kg</span>
      ),
    },
    {
      accessorKey: "total_earned",
      header: "Total",
      cell: ({ row }) => (
        <span className="text-sm">{formatCurrency(row.getValue<number>("total_earned"))}</span>
      ),
    },
    {
      accessorKey: "bonus",
      header: "Bonus",
      cell: ({ row }) => {
        const salary = row.original
        const isEditing = editingBonusId === salary.worker_id

        if (isEditing) {
          return (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="0"
                step="1"
                value={bonusValue}
                onChange={(e) => setBonusValue(e.target.value)}
                className="h-7 w-20 text-xs"
                placeholder="0"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveBonus(salary.worker_id, salary.bonus_id)
                  } else if (e.key === 'Escape') {
                    handleCancelBonus()
                  }
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => handleSaveBonus(salary.worker_id, salary.bonus_id)}
                disabled={savingBonus}
              >
                {savingBonus ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground"
                onClick={handleCancelBonus}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )
        }

        return (
          <div className="flex items-center gap-1 group">
            {salary.bonus > 0 ? (
              <div className="flex items-center gap-1">
                <span className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm">{formatCurrency(salary.bonus)}</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">-</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleEditBonus(salary.worker_id, salary.bonus)}
            >
              <Edit className="h-3 w-3" />
            </Button>
          </div>
        )
      },
    },
    {
      accessorKey: "total_advance",
      header: "Advances",
      cell: ({ row }) => {
        const advance = row.getValue<number>("total_advance")
        return advance > 0 ? (
          <div className="flex items-center gap-1">
            <MinusCircle className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">{formatCurrency(advance)}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )
      },
    },
    {
      accessorKey: "net_salary",
      header: "Net Salary",
      cell: ({ row }) => {
        const salary = row.original
        const netSalary = row.getValue<number>("net_salary")
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-bold cursor-help">
                  {formatCurrency(netSalary)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  <p>Earned: {formatCurrency(salary.total_earned)}</p>
                  <p>+ Bonus: {formatCurrency(salary.bonus)}</p>
                  <p>- Advances: {formatCurrency(salary.total_advance)}</p>
                  <hr className="border-border" />
                  <p className="font-bold">Net: {formatCurrency(netSalary)}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
    {
      accessorKey: "is_paid",
      header: "Status",
      cell: ({ row }) => {
        const salary = row.original
        const isMarking = markingPaidId === salary.worker_id

        return (
          <Button
            variant={salary.is_paid ? "default" : "outline"}
            size="sm"
            className={`h-7 text-xs ${salary.is_paid ? "bg-primary/90" : ""}`}
            onClick={() => handleTogglePaid(salary.worker_id, salary.payment_id, salary.is_paid)}
            disabled={isMarking}
          >
            {isMarking ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : salary.is_paid ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Paid
              </>
            ) : (
              <>
                <Circle className="h-3 w-3 mr-1" />
                Mark Paid
              </>
            )}
          </Button>
        )
      },
    },
  ], [editingBonusId, bonusValue, savingBonus, markingPaidId, handleEditBonus, handleCancelBonus, handleSaveBonus, handleTogglePaid])

  const table = useDataTableInstance({
    data: filteredSalaries,
    columns,
    getRowId: (row) => row.worker_id,
  })

  if (orgLoading || !orgId) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading organization...</span>
      </div>
    )
  }

  if (loading && salaries.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading salary data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold">Salary Management</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToJSON}>
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Month selector */}
          <div className="flex items-center gap-2 bg-muted/50 rounded-md px-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handlePreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 min-w-[140px] justify-center">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {format(selectedMonth, 'MMMM yyyy')}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleNextMonth}
              disabled={addMonths(selectedMonth, 1) > new Date()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid gap-3 grid-cols-2 lg:grid-cols-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Workers</span>
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="text-lg font-bold mt-1">{stats.totalWorkers}</div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Kg</span>
            <Leaf className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="text-lg font-bold mt-1">{stats.totalKg.toFixed(1)} kg</div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Bonus</span>
            <Gift className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="text-lg font-bold mt-1">{formatCurrency(stats.totalBonus)}</div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Paid</span>
            <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="text-lg font-bold mt-1">{formatCurrency(stats.actuallyPaid)}</div>
        </Card>
      </div>

      {/* Salary Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Worker Salaries</CardTitle>
          <CardDescription className="text-xs">
            {filteredSalaries.length} {filteredSalaries.length === 1 ? 'worker' : 'workers'}
            {searchTerm && ` matching "${searchTerm}"`}
            {' • '}{format(selectedMonth, 'MMMM yyyy')}
            {' • '}Hover over bonus to edit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-[400px] overflow-auto rounded-md border">
            <DataTable table={table} columns={columns} />
          </div>
          <DataTablePagination table={table} />
        </CardContent>
      </Card>

      {filteredSalaries.length === 0 && !loading && (
        <div className="text-center py-12">
          <Banknote className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">
            {searchTerm ? `No workers matching "${searchTerm}"` : 'No salary data for this month'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {searchTerm ? 'Try a different search term' : 'Add daily records to see salary calculations'}
          </p>
        </div>
      )}
    </div>
  )
}
