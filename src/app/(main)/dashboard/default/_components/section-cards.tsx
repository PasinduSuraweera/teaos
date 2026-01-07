"use client"

import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrganization } from "@/contexts/organization-context";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { startOfMonth, endOfMonth, subMonths, subDays, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const SL_TIMEZONE = 'Asia/Colombo'

function getSLDate() {
  return formatInTimeZone(new Date(), SL_TIMEZONE, 'yyyy-MM-dd')
}

interface DashboardStats {
  // Revenue from tea sales
  monthlyRevenue: number
  revenueChange: number
  // Expenses from salary payments
  monthlyExpenses: number
  expensesChange: number
  // Profit = Revenue - Expenses
  monthlyProfit: number
  profitChange: number
  // Today's harvest
  todaysHarvest: number
  harvestChange: number
}

export function SectionCards() {
  const { currentOrganization, loading: orgLoading } = useOrganization()
  const orgId = currentOrganization?.organization_id
  
  const [stats, setStats] = useState<DashboardStats>({
    monthlyRevenue: 0,
    revenueChange: 0,
    monthlyExpenses: 0,
    expensesChange: 0,
    monthlyProfit: 0,
    profitChange: 0,
    todaysHarvest: 0,
    harvestChange: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (orgId) {
      fetchStats()
    }
    
    async function fetchStats() {
      if (!orgId) return
      try {
        const today = new Date()
        const todayStr = getSLDate()
        const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd')
        const currentMonth = startOfMonth(today)
        const currentMonthEnd = endOfMonth(today)
        const lastMonth = subMonths(currentMonth, 1)
        const lastMonthEnd = endOfMonth(lastMonth)

        // Helper function to query with org fallback
        async function queryWithFallback<T>(
          table: string,
          select: string,
          filters: { [key: string]: any },
          dateRange?: { from: string; to: string; field: string }
        ): Promise<T[]> {
          let query = supabase.from(table).select(select).eq('organization_id', orgId)
          
          Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value)
          })
          
          if (dateRange) {
            query = query.gte(dateRange.field, dateRange.from).lte(dateRange.field, dateRange.to)
          }
          
          const { data, error } = await query
          
          if (error) {
            if (error.message?.includes('organization_id') || error.code === '42703') {
              // Fallback without org filter
              let fallbackQuery = supabase.from(table).select(select)
              Object.entries(filters).forEach(([key, value]) => {
                fallbackQuery = fallbackQuery.eq(key, value)
              })
              if (dateRange) {
                fallbackQuery = fallbackQuery.gte(dateRange.field, dateRange.from).lte(dateRange.field, dateRange.to)
              }
              const { data: fallbackData } = await fallbackQuery
              return (fallbackData || []) as T[]
            }
            if (error.message?.includes('does not exist')) {
              return []
            }
            throw error
          }
          
          return (data || []) as T[]
        }

        // === REVENUE: From tea_sales ===
        const currentSales = await queryWithFallback<{ total_income: number }>(
          'tea_sales',
          'total_income',
          {},
          { from: format(currentMonth, 'yyyy-MM-dd'), to: format(currentMonthEnd, 'yyyy-MM-dd'), field: 'date' }
        )

        const lastSales = await queryWithFallback<{ total_income: number }>(
          'tea_sales',
          'total_income',
          {},
          { from: format(lastMonth, 'yyyy-MM-dd'), to: format(lastMonthEnd, 'yyyy-MM-dd'), field: 'date' }
        )

        const monthlyRevenue = currentSales.reduce((sum, s) => sum + (s.total_income || 0), 0)
        const lastMonthRevenue = lastSales.reduce((sum, s) => sum + (s.total_income || 0), 0)
        const revenueChange = lastMonthRevenue > 0 
          ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
          : 0

        // === EXPENSES: Calculate from daily_plucking + bonuses - advances ===
        const currentPayments = await queryWithFallback<{
          kg_plucked: number
          rate_per_kg: number
          is_advance: boolean
          extra_work_payment: number
          wage_earned: number
          worker_id: string
        }>(
          'daily_plucking',
          'kg_plucked, rate_per_kg, is_advance, extra_work_payment, wage_earned, worker_id',
          {},
          { from: format(currentMonth, 'yyyy-MM-dd'), to: format(currentMonthEnd, 'yyyy-MM-dd'), field: 'date' }
        )

        const lastPayments = await queryWithFallback<{
          kg_plucked: number
          rate_per_kg: number
          is_advance: boolean
          extra_work_payment: number
          wage_earned: number
          worker_id: string
        }>(
          'daily_plucking',
          'kg_plucked, rate_per_kg, is_advance, extra_work_payment, wage_earned, worker_id',
          {},
          { from: format(lastMonth, 'yyyy-MM-dd'), to: format(lastMonthEnd, 'yyyy-MM-dd'), field: 'date' }
        )

        // Fetch bonuses for current and last month
        const currentBonuses = await queryWithFallback<{ amount: number }>(
          'worker_bonuses',
          'amount',
          { month: format(currentMonth, 'yyyy-MM-dd') }
        )

        const lastBonuses = await queryWithFallback<{ amount: number }>(
          'worker_bonuses',
          'amount',
          { month: format(lastMonth, 'yyyy-MM-dd') }
        )

        // Calculate current month: earnings + bonuses - advances
        let currentEarnings = 0
        let currentAdvances = 0
        currentPayments.forEach(p => {
          if (p.is_advance) {
            currentAdvances += Math.abs(p.wage_earned || 0)
          } else {
            const pluckingAmount = (p.kg_plucked || 0) * (p.rate_per_kg || 0)
            const extraWorkAmount = p.extra_work_payment || 0
            currentEarnings += pluckingAmount + extraWorkAmount
          }
        })
        const currentBonusTotal = currentBonuses.reduce((sum, b) => sum + (b.amount || 0), 0)
        const monthlyExpenses = currentEarnings + currentBonusTotal - currentAdvances

        // Calculate last month: earnings + bonuses - advances
        let lastEarnings = 0
        let lastAdvances = 0
        lastPayments.forEach(p => {
          if (p.is_advance) {
            lastAdvances += Math.abs(p.wage_earned || 0)
          } else {
            const pluckingAmount = (p.kg_plucked || 0) * (p.rate_per_kg || 0)
            const extraWorkAmount = p.extra_work_payment || 0
            lastEarnings += pluckingAmount + extraWorkAmount
          }
        })
        const lastBonusTotal = lastBonuses.reduce((sum, b) => sum + (b.amount || 0), 0)
        const lastMonthExpenses = lastEarnings + lastBonusTotal - lastAdvances
        const expensesChange = lastMonthExpenses > 0 
          ? ((monthlyExpenses - lastMonthExpenses) / lastMonthExpenses) * 100 
          : 0

        // === PROFIT: Revenue - Expenses ===
        const monthlyProfit = monthlyRevenue - monthlyExpenses
        const lastMonthProfit = lastMonthRevenue - lastMonthExpenses
        const profitChange = lastMonthProfit !== 0 
          ? ((monthlyProfit - lastMonthProfit) / Math.abs(lastMonthProfit)) * 100 
          : 0

        // === TODAY'S HARVEST ===
        const todaysData = await queryWithFallback<{ kg_plucked: number; is_advance: boolean }>(
          'daily_plucking',
          'kg_plucked, is_advance',
          { date: todayStr }
        )

        const yesterdaysData = await queryWithFallback<{ kg_plucked: number; is_advance: boolean }>(
          'daily_plucking',
          'kg_plucked, is_advance',
          { date: yesterdayStr }
        )

        // Only count plucking records (not advances)
        const todaysHarvest = todaysData
          .filter(d => !d.is_advance)
          .reduce((sum, d) => sum + (d.kg_plucked || 0), 0)
        const yesterdaysHarvest = yesterdaysData
          .filter(d => !d.is_advance)
          .reduce((sum, d) => sum + (d.kg_plucked || 0), 0)
        const harvestChange = yesterdaysHarvest > 0 
          ? ((todaysHarvest - yesterdaysHarvest) / yesterdaysHarvest) * 100 
          : 0

        setStats({
          monthlyRevenue,
          revenueChange,
          monthlyExpenses,
          expensesChange,
          monthlyProfit,
          profitChange,
          todaysHarvest,
          harvestChange,
        })
      } catch (error: any) {
        console.error('Error fetching dashboard stats:', error?.message || error)
      } finally {
        setLoading(false)
      }
    }
  }, [orgId])

  if (orgLoading || !orgId) {
    return (
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="@container/card animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-20"></div>
              <div className="h-8 bg-muted rounded w-24 mt-2"></div>
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="@container/card animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-20"></div>
              <div className="h-8 bg-muted rounded w-24 mt-2"></div>
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {/* Revenue Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Monthly Revenue</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
            {formatCurrency(stats.monthlyRevenue)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-xs px-1.5 whitespace-nowrap">
              {stats.revenueChange >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {stats.revenueChange >= 0 ? '+' : ''}{stats.revenueChange.toFixed(0)}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">
            From tea sales
          </div>
          <div className="text-muted-foreground">Compared to last month</div>
        </CardFooter>
      </Card>

      {/* Expenses Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Monthly Expenses</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
            {formatCurrency(stats.monthlyExpenses)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-xs px-1.5 whitespace-nowrap">
              {stats.expensesChange <= 0 ? <TrendingDown className="size-3" /> : <TrendingUp className="size-3" />}
              {stats.expensesChange >= 0 ? '+' : ''}{stats.expensesChange.toFixed(0)}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">
            Worker payments
          </div>
          <div className="text-muted-foreground">Salaries & advances</div>
        </CardFooter>
      </Card>

      {/* Profit Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Monthly Profit</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
            {formatCurrency(stats.monthlyProfit)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-xs px-1.5 whitespace-nowrap">
              {stats.profitChange >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {stats.profitChange >= 0 ? '+' : ''}{stats.profitChange.toFixed(0)}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">
            Revenue - Expenses
          </div>
          <div className="text-muted-foreground">Net profit this month</div>
        </CardFooter>
      </Card>

      {/* Today's Harvest Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Today's Harvest</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
            {stats.todaysHarvest.toFixed(1)} kg
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-xs px-1.5 whitespace-nowrap">
              {stats.harvestChange >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {stats.harvestChange >= 0 ? '+' : ''}{stats.harvestChange.toFixed(0)}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 font-medium">
            Tea leaves plucked
          </div>
          <div className="text-muted-foreground">Compared to yesterday</div>
        </CardFooter>
      </Card>
    </div>
  );
}
