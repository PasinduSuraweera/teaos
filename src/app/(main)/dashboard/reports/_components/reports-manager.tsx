"use client"

import { useState } from "react"
import { FileText, Download, Loader2, Calendar, Users, Leaf, TrendingUp, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { useOrganization } from "@/contexts/organization-context"

interface ReportType {
  id: string
  title: string
  description: string
  icon: React.ElementType
}

const REPORT_TYPES: ReportType[] = [
  {
    id: 'daily-records',
    title: 'Daily Records Report',
    description: 'Daily plucking records with worker details and wages',
    icon: Leaf,
  },
  {
    id: 'salary',
    title: 'Salary Report',
    description: 'Monthly salary summary for all workers',
    icon: DollarSign,
  },
  {
    id: 'workers',
    title: 'Workers Report',
    description: 'Complete list of workers with details',
    icon: Users,
  },
  {
    id: 'tea-sales',
    title: 'Tea Sales Report',
    description: 'Tea sales and revenue summary',
    icon: TrendingUp,
  },
  {
    id: 'financial',
    title: 'Financial Summary',
    description: 'Revenue, expenses and profit overview',
    icon: DollarSign,
  },
]

export function ReportsManager() {
  const { currentOrganization, loading: orgLoading } = useOrganization()
  const orgId = currentOrganization?.organization_id
  
  const [selectedReport, setSelectedReport] = useState<string>("")
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [generating, setGenerating] = useState(false)

  const handleGenerateReport = async () => {
    if (!selectedReport) {
      toast.error("Please select a report type")
      return
    }

    setGenerating(true)

    try {
      let reportData: any = null
      let reportTitle = ""

      switch (selectedReport) {
        case 'daily-records':
          reportTitle = "Daily Records Report"
          const { data: records } = await supabase
            .from('daily_plucking')
            .select(`
              *,
              workers (first_name, last_name, employee_id)
            `)
            .eq('organization_id', orgId)
            .gte('date', dateFrom)
            .lte('date', dateTo)
            .order('date', { ascending: false })
          reportData = records
          break

        case 'salary':
          reportTitle = "Salary Report"
          const { data: salaryRecords } = await supabase
            .from('daily_plucking')
            .select(`
              *,
              workers (first_name, last_name, employee_id)
            `)
            .eq('organization_id', orgId)
            .gte('date', dateFrom)
            .lte('date', dateTo)
          reportData = salaryRecords
          break

        case 'workers':
          reportTitle = "Workers Report"
          const { data: workers } = await supabase
            .from('workers')
            .select('*')
            .eq('organization_id', orgId)
            .order('first_name')
          reportData = workers
          break

        case 'tea-sales':
          reportTitle = "Tea Sales Report"
          const { data: sales } = await supabase
            .from('tea_sales')
            .select('*')
            .eq('organization_id', orgId)
            .gte('date', dateFrom)
            .lte('date', dateTo)
            .order('date', { ascending: false })
          reportData = sales
          break

        case 'financial':
          reportTitle = "Financial Summary"
          const { data: salesData } = await supabase
            .from('tea_sales')
            .select('total_income')
            .eq('organization_id', orgId)
            .gte('date', dateFrom)
            .lte('date', dateTo)
          
          const { data: pluckingData } = await supabase
            .from('daily_plucking')
            .select('kg_plucked, rate_per_kg')
            .eq('organization_id', orgId)
            .gte('date', dateFrom)
            .lte('date', dateTo)
          
          const totalRevenue = salesData?.reduce((sum, s) => sum + (s.total_income || 0), 0) || 0
          const totalExpenses = pluckingData?.reduce((sum, p) => sum + ((p.kg_plucked || 0) * (p.rate_per_kg || 0)), 0) || 0
          
          reportData = {
            revenue: totalRevenue,
            expenses: totalExpenses,
            profit: totalRevenue - totalExpenses,
          }
          break
      }

      // Generate printable HTML
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        toast.error("Please allow popups to generate reports")
        return
      }

      const reportHtml = generateReportHtml(selectedReport, reportTitle, reportData, dateFrom, dateTo)
      printWindow.document.write(reportHtml)
      printWindow.document.close()
      
      // Auto print
      setTimeout(() => {
        printWindow.print()
      }, 500)

      toast.success("Report generated successfully")
    } catch (error: any) {
      console.error('Error generating report:', error)
      toast.error(error.message || "Failed to generate report")
    } finally {
      setGenerating(false)
    }
  }

  const generateReportHtml = (type: string, title: string, data: any, from: string, to: string) => {
    const dateRange = `${format(new Date(from), 'MMM d, yyyy')} - ${format(new Date(to), 'MMM d, yyyy')}`
    
    let tableHtml = ""

    switch (type) {
      case 'daily-records':
        tableHtml = `
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee ID</th>
                <th>Worker</th>
                <th>Type</th>
                <th class="number">Kg Plucked</th>
                <th class="number">Rate/Kg</th>
                <th class="number">Extra Work</th>
                <th class="number">Total Wage</th>
              </tr>
            </thead>
            <tbody>
              ${(data || []).map((r: any) => {
                const isAdvance = r.is_advance || false
                const pluckingAmount = isAdvance ? 0 : (r.kg_plucked || 0) * (r.rate_per_kg || 0)
                const extraWork = r.extra_work_payment || 0
                const totalWage = isAdvance ? Math.abs(r.kg_plucked || 0) : pluckingAmount + extraWork
                
                // Parse extra work items if available
                let extraWorkDetails = ''
                try {
                  if (r.notes) {
                    const notesData = JSON.parse(r.notes)
                    if (notesData.extra_work && notesData.extra_work.length > 0) {
                      extraWorkDetails = '<br><small style="color: #666;">' + 
                        notesData.extra_work.map((w: any) => `${w.description}: ${formatCurrency(w.amount)}`).join(', ') +
                        '</small>'
                    }
                  }
                } catch (e) {}
                
                return `
                <tr>
                  <td>${format(new Date(r.date), 'MMM d, yyyy')}</td>
                  <td>${r.workers?.employee_id || '-'}</td>
                  <td>${r.workers?.first_name || ''} ${r.workers?.last_name || ''}</td>
                  <td>${isAdvance ? '<span style="color: #dc2626;">Advance</span>' : (extraWork > 0 ? 'Plucking + Work' : 'Plucking')}</td>
                  <td class="number">${isAdvance ? '-' : (r.kg_plucked?.toFixed(1) || 0) + ' kg'}</td>
                  <td class="number">${isAdvance ? '-' : formatCurrency(r.rate_per_kg || 0)}</td>
                  <td class="number">${extraWork > 0 ? formatCurrency(extraWork) + extraWorkDetails : '-'}</td>
                  <td class="number" style="font-weight: 600;">${isAdvance ? '<span style="color: #dc2626;">-' : ''}${formatCurrency(totalWage)}${isAdvance ? '</span>' : ''}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
        `
        break

      case 'workers':
        tableHtml = `
          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Hire Date</th>
              </tr>
            </thead>
            <tbody>
              ${(data || []).map((w: any) => `
                <tr>
                  <td>${w.employee_id}</td>
                  <td>${w.first_name} ${w.last_name || ''}</td>
                  <td>${w.role}</td>
                  <td>${w.phone || '-'}</td>
                  <td>${w.status}</td>
                  <td>${w.hire_date ? format(new Date(w.hire_date), 'MMM d, yyyy') : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `
        break

      case 'tea-sales':
        tableHtml = `
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th class="number">Quantity (Kg)</th>
                <th class="number">Rate/Kg</th>
                <th class="number">Total Income</th>
              </tr>
            </thead>
            <tbody>
              ${(data || []).map((s: any) => `
                <tr>
                  <td>${format(new Date(s.date), 'MMM d, yyyy')}</td>
                  <td class="number">${s.quantity_kg?.toFixed(1) || 0} kg</td>
                  <td class="number">${formatCurrency(s.rate_per_kg || 0)}</td>
                  <td class="number">${formatCurrency(s.total_income || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `
        break

      case 'financial':
        tableHtml = `
          <div class="summary-cards">
            <div class="summary-card">
              <h3>Total Revenue</h3>
              <p class="amount positive">${formatCurrency(data?.revenue || 0)}</p>
            </div>
            <div class="summary-card">
              <h3>Total Expenses</h3>
              <p class="amount negative">${formatCurrency(data?.expenses || 0)}</p>
            </div>
            <div class="summary-card">
              <h3>Net Profit</h3>
              <p class="amount ${data?.profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(data?.profit || 0)}</p>
            </div>
          </div>
        `
        break

      case 'salary':
        // Group by worker
        const workerMap = new Map()
        ;(data || []).forEach((r: any) => {
          const workerId = r.worker_id
          if (!workerMap.has(workerId)) {
            workerMap.set(workerId, {
              employee_id: r.workers?.employee_id,
              name: `${r.workers?.first_name || ''} ${r.workers?.last_name || ''}`,
              total_kg: 0,
              total_earned: 0,
              days: 0,
            })
          }
          const w = workerMap.get(workerId)
          if (!r.is_advance) {
            w.total_kg += r.kg_plucked || 0
            w.total_earned += (r.kg_plucked || 0) * (r.rate_per_kg || 0)
            w.days += 1
          }
        })

        tableHtml = `
          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Worker</th>
                <th class="number">Days Worked</th>
                <th class="number">Total Kg</th>
                <th class="number">Total Earned</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from(workerMap.values()).map((w: any) => `
                <tr>
                  <td>${w.employee_id || '-'}</td>
                  <td>${w.name}</td>
                  <td class="number">${w.days}</td>
                  <td class="number">${w.total_kg.toFixed(1)} kg</td>
                  <td class="number">${formatCurrency(w.total_earned)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `
        break
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            .header { margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .header h1 { font-size: 24px; margin-bottom: 5px; }
            .header p { color: #666; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #f5f5f5; font-weight: 600; }
            .number { text-align: right; }
            .summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 20px; }
            .summary-card { background: #f9f9f9; padding: 20px; border-radius: 8px; text-align: center; }
            .summary-card h3 { font-size: 14px; color: #666; margin-bottom: 10px; }
            .summary-card .amount { font-size: 24px; font-weight: bold; }
            .positive { color: #16a34a; }
            .negative { color: #dc2626; }
            .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; }
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            <p>${dateRange} • Generated on ${format(new Date(), 'MMM d, yyyy h:mm a')}</p>
          </div>
          ${tableHtml}
          <div class="footer">
            <p>Tea Plantation Management System</p>
          </div>
        </body>
      </html>
    `
  }

  const handleQuickSelect = (period: string) => {
    const today = new Date()
    switch (period) {
      case 'this-month':
        setDateFrom(format(startOfMonth(today), 'yyyy-MM-dd'))
        setDateTo(format(endOfMonth(today), 'yyyy-MM-dd'))
        break
      case 'last-month':
        const lastMonth = subMonths(today, 1)
        setDateFrom(format(startOfMonth(lastMonth), 'yyyy-MM-dd'))
        setDateTo(format(endOfMonth(lastMonth), 'yyyy-MM-dd'))
        break
      case 'last-3-months':
        setDateFrom(format(startOfMonth(subMonths(today, 2)), 'yyyy-MM-dd'))
        setDateTo(format(endOfMonth(today), 'yyyy-MM-dd'))
        break
    }
  }

  if (orgLoading || !orgId) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading organization...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl font-semibold">PDF Reports</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Report Selection */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Select Report Type</CardTitle>
            <CardDescription className="text-xs">Choose the type of report you want to generate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {REPORT_TYPES.map(report => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report.id)}
                  className={`
                    flex items-start gap-3 p-4 rounded-lg border text-left transition-colors
                    ${selectedReport === report.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:bg-muted'
                    }
                  `}
                >
                  <div className={`
                    p-2 rounded-md
                    ${selectedReport === report.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}
                  `}>
                    <report.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{report.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{report.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Date Range & Generate */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Date Range</CardTitle>
            <CardDescription className="text-xs">Select the period for your report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => handleQuickSelect('this-month')}>
                This Month
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickSelect('last-month')}>
                Last Month
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickSelect('last-3-months')}>
                Last 3 Months
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="dateFrom">From</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo">To</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleGenerateReport}
              disabled={!selectedReport || generating}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
