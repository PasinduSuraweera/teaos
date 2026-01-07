"use client"

import { useState, useEffect } from "react"
import { X, Edit, MapPin, Calendar, Leaf } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Plantation } from "@/types/database"

interface PlantationDetailsProps {
  plantation: Plantation
  onClose: () => void
  onEdit: () => void
}

export function PlantationDetails({ plantation, onClose, onEdit }: PlantationDetailsProps) {
  const [stats, setStats] = useState({
    totalWorkers: 0,
    monthlyHarvest: 0,
    avgDailyOutput: 0,
  })

  useEffect(() => {
    fetchPlantationData()
  }, [plantation.id])

  const fetchPlantationData = async () => {
    try {
      // Fetch workers count
      const { data: workersData } = await supabase
        .from('workers')
        .select('id')
        .eq('plantation_id', plantation.id)
        .eq('status', 'active')

      // Calculate stats
      const currentMonth = new Date()
      const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      
      const { data: monthlyHarvestData } = await supabase
        .from('harvest_records')
        .select('quantity_kg')
        .eq('plantation_id', plantation.id)
        .gte('harvest_date', firstDayOfMonth.toISOString().split('T')[0])

      const totalMonthlyHarvest = monthlyHarvestData?.reduce((sum, record) => sum + record.quantity_kg, 0) || 0
      const currentDay = currentMonth.getDate()

      setStats({
        totalWorkers: workersData?.length || 0,
        monthlyHarvest: totalMonthlyHarvest,
        avgDailyOutput: totalMonthlyHarvest / currentDay,
      })
    } catch (error) {
      console.error('Error fetching plantation data:', error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{plantation.name}</CardTitle>
              <CardDescription className="flex items-center gap-1 text-xs">
                <MapPin className="h-3 w-3" />
                {plantation.location}
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Button variant="default" size="sm" onClick={onEdit} className="h-7 text-xs">
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {/* Plantation Image */}
          {plantation.image_url && (
            <div className="relative aspect-video w-full rounded-md overflow-hidden bg-muted">
              <Image
                src={plantation.image_url}
                alt={plantation.name}
                fill
                sizes="400px"
                className="object-cover"
                quality={85}
                priority
              />
            </div>
          )}

          {/* Stats - Compact 2x2 Grid */}
          <div className="grid gap-2 grid-cols-2">
            <div className="bg-muted/50 rounded-md p-2">
              <div className="text-lg font-bold">{stats.totalWorkers}</div>
              <p className="text-xs text-muted-foreground">Workers</p>
            </div>
            <div className="bg-muted/50 rounded-md p-2">
              <div className="text-lg font-bold">{stats.monthlyHarvest.toFixed(0)}<span className="text-xs font-normal"> kg</span></div>
              <p className="text-xs text-muted-foreground">Monthly</p>
            </div>
            <div className="bg-muted/50 rounded-md p-2">
              <div className="text-lg font-bold">{stats.avgDailyOutput.toFixed(1)}<span className="text-xs font-normal"> kg</span></div>
              <p className="text-xs text-muted-foreground">Daily Avg</p>
            </div>
            <div className="bg-muted/50 rounded-md p-2">
              <div className="text-lg font-bold">{plantation.area_hectares}<span className="text-xs font-normal"> ha</span></div>
              <p className="text-xs text-muted-foreground">Area</p>
            </div>
          </div>

          {/* Details - Inline */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Leaf className="h-3 w-3 text-green-600" /> Variety
              </span>
              <span>{plantation.tea_variety}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3 text-orange-600" /> Established
              </span>
              <span>{plantation.established_date ? new Date(plantation.established_date).toLocaleDateString() : 'Not specified'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}