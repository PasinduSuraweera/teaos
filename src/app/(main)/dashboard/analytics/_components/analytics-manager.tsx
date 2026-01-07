"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, TrendingUp, Users, Leaf, DollarSign, Loader2 } from "lucide-react"
import { Bar, BarChart as RechartsBarChart, XAxis, YAxis, CartesianGrid, Line, LineChart, ResponsiveContainer } from "recharts"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { supabase } from "@/lib/supabase"
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { formatCurrency } from "@/lib/utils"
import { useOrganization } from "@/contexts/organization-context"

interface AnalyticsStats {
  totalPlantations: number
  totalWorkers: number
  monthlyHarvest: number
  monthlyRevenue: number
}

interface MonthlyData {
  month: string
  harvest: number
  revenue: number
}

interface WorkerPerformance {
  name: string
  totalKg: number
  totalIncome: number
}

const monthlyTrendsConfig = {
  harvest: {
    label: "Harvest (kg)",
    color: "hsl(var(--chart-1))",
  },
  revenue: {
    label: "Revenue (LKR)",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

const workerPerformanceConfig = {
  totalKg: {
    label: "Harvest (kg)",
    color: "hsl(var(--chart-3))",
  },
  totalIncome: {
    label: "Income (LKR)",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig

const revenueConfig = {
  revenue: {
    label: "Revenue (LKR)",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function AnalyticsManager() {
  const { currentOrganization, loading: orgLoading } = useOrganization()
  const orgId = currentOrganization?.organization_id
  
  const [stats, setStats] = useState<AnalyticsStats>({
    totalPlantations: 0,
    totalWorkers: 0,
    monthlyHarvest: 0,
    monthlyRevenue: 0,
  })
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyData[]>([])
  const [workerPerformance, setWorkerPerformance] = useState<WorkerPerformance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return
    
    async function fetchAnalyticsData() {
    if (!orgId) return
    try {
      const currentMonth = new Date()
      const startOfCurrentMonth = startOfMonth(currentMonth)
      const endOfCurrentMonth = endOfMonth(currentMonth)

      // Get total plantations
      const { count: plantationsCount } = await supabase
        .from('plantations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)

      // Get total workers
      const { count: workersCount } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'active')

      // Get current month harvest and revenue
      const { data: currentMonthData, error: currentMonthError } = await supabase
        .from('daily_plucking')
        .select('kg_plucked, total_income')
        .eq('organization_id', orgId)
        .gte('date', format(startOfCurrentMonth, 'yyyy-MM-dd'))
        .lte('date', format(endOfCurrentMonth, 'yyyy-MM-dd'))

        // Handle missing table gracefully
        if (currentMonthError?.message?.includes('relation "daily_plucking" does not exist')) {
          console.log('Daily plucking table not yet created - showing empty analytics')
          setStats({
            totalPlantations: plantationsCount || 0,
            totalWorkers: workersCount || 0,
            monthlyHarvest: 0,
            monthlyRevenue: 0,
          })
          setMonthlyTrends([])
          setWorkerPerformance([])
          return
        }

        const monthlyHarvest = currentMonthData?.reduce((sum, record) => sum + (record.kg_plucked || 0), 0) || 0
        const monthlyRevenue = currentMonthData?.reduce((sum, record) => sum + (record.total_income || 0), 0) || 0

        setStats({
          totalPlantations: plantationsCount || 0,
          totalWorkers: workersCount || 0,
          monthlyHarvest: Number(monthlyHarvest.toFixed(1)),
          monthlyRevenue: Number(monthlyRevenue.toFixed(2)),
        })

        // Get last 6 months trend data
        const monthlyPromises = []
        for (let i = 5; i >= 0; i--) {
          const month = subMonths(currentMonth, i)
          const monthStart = startOfMonth(month)
          const monthEnd = endOfMonth(month)
          
          monthlyPromises.push(
            supabase
              .from('daily_plucking')
              .select('kg_plucked, total_income')
              .gte('date', format(monthStart, 'yyyy-MM-dd'))
              .lte('date', format(monthEnd, 'yyyy-MM-dd'))
              .then(result => ({
                month: format(month, 'MMM'),
                data: result.data || []
              }))
          )
        }

        const monthlyResults = await Promise.all(monthlyPromises)
        const trendsData: MonthlyData[] = monthlyResults.map(result => ({
          month: result.month,
          harvest: Number(result.data.reduce((sum, record) => sum + (record.kg_plucked || 0), 0).toFixed(1)),
          revenue: Number(result.data.reduce((sum, record) => sum + (record.total_income || 0), 0).toFixed(2))
        }))

        setMonthlyTrends(trendsData)

        // Get top worker performance for current month
        const { data: workerData } = await supabase
          .from('daily_plucking')
          .select(`
            kg_plucked,
            total_income,
            workers (
              first_name,
              last_name
            )
          `)
          .gte('date', format(startOfCurrentMonth, 'yyyy-MM-dd'))
          .lte('date', format(endOfCurrentMonth, 'yyyy-MM-dd'))

        // Aggregate worker performance
        const workerMap = new Map<string, { totalKg: number, totalIncome: number }>()
        
        workerData?.forEach(record => {
          const worker = record.workers as any
          const workerName = `${worker?.first_name || ''} ${worker?.last_name || ''}`.trim()
          
          if (workerName && workerName !== '') {
            const existing = workerMap.get(workerName) || { totalKg: 0, totalIncome: 0 }
            workerMap.set(workerName, {
              totalKg: existing.totalKg + (record.kg_plucked || 0),
              totalIncome: existing.totalIncome + (record.total_income || 0)
            })
          }
        })

        const topWorkers: WorkerPerformance[] = Array.from(workerMap.entries())
          .map(([name, data]) => ({
            name,
            totalKg: Number(data.totalKg.toFixed(1)),
            totalIncome: Number(data.totalIncome.toFixed(2))
          }))
          .sort((a, b) => b.totalKg - a.totalKg)
          .slice(0, 5)

        setWorkerPerformance(topWorkers)

      } catch (error) {
        console.error('Error fetching analytics data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalyticsData()
  }, [orgId])

  if (orgLoading || !orgId) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                <div className="h-4 w-4 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                <div className="h-4 w-4 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="h-6 w-32 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-[300px] bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="h-6 w-32 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-[300px] bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics & Insights</h2>
          <p className="text-muted-foreground">Tea plantation performance insights and detailed analytics</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plantations</CardTitle>
            <Leaf className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPlantations}</div>
            <p className="text-xs text-muted-foreground">Active plantation sites</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWorkers}</div>
            <p className="text-xs text-muted-foreground">Active workforce</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Harvest</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.monthlyHarvest} kg</div>
            <p className="text-xs text-muted-foreground">Current month total</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.monthlyRevenue)}</div>
            <p className="text-xs text-muted-foreground">Current month income</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Reports */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>6-Month Harvest Trends</CardTitle>
            <CardDescription>Monthly harvest performance over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={monthlyTrendsConfig}>
              <RechartsBarChart
                accessibilityLayer
                data={monthlyTrends}
                margin={{
                  top: 20,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Bar dataKey="harvest" fill="var(--color-harvest)" radius={8} />
              </RechartsBarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Top Worker Performance</CardTitle>
            <CardDescription>Best performing workers this month by harvest quantity</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={workerPerformanceConfig}>
              <RechartsBarChart
                accessibilityLayer
                data={workerPerformance}
                layout="horizontal"
                margin={{
                  left: 50,
                }}
              >
                <CartesianGrid horizontal={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  width={80}
                  fontSize={12}
                />
                <XAxis type="number" hide />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Bar dataKey="totalKg" fill="var(--color-totalKg)" radius={5} />
              </RechartsBarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>Revenue Trends</CardTitle>
          <CardDescription>Monthly revenue performance over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={revenueConfig}>
            <LineChart
              accessibilityLayer
              data={monthlyTrends}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Line
                dataKey="revenue"
                type="natural"
                stroke="var(--color-revenue)"
                strokeWidth={3}
                dot={{
                  fill: "var(--color-revenue)",
                }}
                activeDot={{
                  r: 6,
                }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  )
}