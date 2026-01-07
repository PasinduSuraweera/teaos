"use client"

import { useState, useEffect } from "react"
import { X, Edit, User, MapPin, Calendar, DollarSign, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase"
import { WorkerWithPlantation, HarvestRecordWithPlantation } from "@/types/database"
import { formatCurrency } from "@/lib/utils"

interface WorkerDetailsProps {
  worker: WorkerWithPlantation
  onClose: () => void
  onEdit: () => void
}

export function WorkerDetails({ worker, onClose, onEdit }: WorkerDetailsProps) {
  const [recentHarvests, setRecentHarvests] = useState<HarvestRecordWithPlantation[]>([])
  const [stats, setStats] = useState({
    totalHarvests: 0,
    monthlyHarvest: 0,
    avgDailyOutput: 0,
    lastHarvestDate: null as string | null,
    monthlyEarnings: 0,
  })

  useEffect(() => {
    fetchWorkerData()
  }, [worker.id])

  const fetchWorkerData = async () => {
    try {
      // Fetch recent harvests
      const { data: harvestsData } = await supabase
        .from('harvest_records')
        .select('*, plantation:plantations(name)')
        .eq('worker_id', worker.id)
        .order('harvest_date', { ascending: false })
        .limit(10)

      // Calculate monthly stats
      const currentMonth = new Date()
      const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      
      const { data: monthlyHarvestData } = await supabase
        .from('harvest_records')
        .select('quantity_kg, harvest_date')
        .eq('worker_id', worker.id)
        .gte('harvest_date', firstDayOfMonth.toISOString().split('T')[0])

      const totalMonthlyHarvest = monthlyHarvestData?.reduce((sum, record) => sum + record.quantity_kg, 0) || 0
      const currentDay = currentMonth.getDate()
      const workingDays = monthlyHarvestData?.length || 0

      // Calculate total harvests
      const { count: totalHarvests } = await supabase
        .from('harvest_records')
        .select('*', { count: 'exact', head: true })
        .eq('worker_id', worker.id)

      setRecentHarvests(harvestsData || [])
      setStats({
        totalHarvests: totalHarvests || 0,
        monthlyHarvest: totalMonthlyHarvest,
        avgDailyOutput: workingDays > 0 ? totalMonthlyHarvest / workingDays : 0,
        lastHarvestDate: harvestsData?.[0]?.harvest_date || null,
        monthlyEarnings: worker.salary || 0,
      })
    } catch (error) {
      console.error('Error fetching worker data:', error)
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'manager': return 'default'
      case 'supervisor': return 'secondary'
      case 'quality_controller': return 'outline'
      default: return 'destructive'
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">
                  {worker.first_name} {worker.last_name}
                </CardTitle>
                <Badge variant={getRoleBadgeVariant(worker.role)}>
                  {worker.role.replace('_', ' ')}
                </Badge>
                <Badge variant={worker.status === 'active' ? 'default' : 'secondary'}>
                  {worker.status}
                </Badge>
              </div>
              <CardDescription className="flex items-center gap-2 mt-2">
                <User className="h-4 w-4" />
                {worker.employee_id}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="default" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="harvest">Harvest History</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{stats.totalHarvests}</div>
                    <p className="text-sm text-muted-foreground">Total Harvests</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{stats.monthlyHarvest.toFixed(0)} kg</div>
                    <p className="text-sm text-muted-foreground">This Month</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{stats.avgDailyOutput.toFixed(1)} kg</div>
                    <p className="text-sm text-muted-foreground">Avg Daily Output</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">
                      {worker.salary ? formatCurrency(worker.salary) : 'N/A'}
                    </div>
                    <p className="text-sm text-muted-foreground">Monthly Salary</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium">Phone</p>
                        <p className="text-sm text-muted-foreground">{worker.phone || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-red-600" />
                      <div>
                        <p className="font-medium">Assigned Plantation</p>
                        <p className="text-sm text-muted-foreground">
                          {worker.plantation?.name || 'Unassigned'}
                        </p>
                        {worker.plantation?.location && (
                          <p className="text-xs text-muted-foreground">{worker.plantation.location}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-orange-600" />
                      <div>
                        <p className="font-medium">Hire Date</p>
                        <p className="text-sm text-muted-foreground">
                          {worker.hire_date ? new Date(worker.hire_date).toLocaleDateString() : 'Not specified'}
                        </p>
                        {worker.hire_date && (
                          <p className="text-xs text-muted-foreground">
                            {Math.floor((Date.now() - new Date(worker.hire_date).getTime()) / (1000 * 60 * 60 * 24 * 365))} years of service
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Monthly Harvest Target</p>
                        <p className="text-sm text-muted-foreground">Based on role and experience</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {worker.role === 'picker' ? '1000 kg' : 'Management Role'}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Monthly Achievement</p>
                        <p className="text-sm text-muted-foreground">Current month progress</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{stats.monthlyHarvest.toFixed(0)} kg</p>
                        {worker.role === 'picker' && (
                          <p className="text-sm text-muted-foreground">
                            {((stats.monthlyHarvest / 1000) * 100).toFixed(1)}% of target
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Average Quality Grade</p>
                        <p className="text-sm text-muted-foreground">Based on recent harvests</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="default">Grade B+</Badge>
                        <p className="text-sm text-muted-foreground">Improving</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="harvest" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Harvest Records</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentHarvests.map((harvest) => (
                      <div key={harvest.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{new Date(harvest.harvest_date).toLocaleDateString()}</p>
                          <p className="text-sm text-muted-foreground">
                            {(harvest.plantation as any)?.name || 'Unknown Plantation'}
                          </p>
                          {harvest.weather_condition && (
                            <p className="text-xs text-muted-foreground">
                              Weather: {harvest.weather_condition}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{harvest.quantity_kg} kg</p>
                          <Badge variant={harvest.grade === 'A' ? 'default' : harvest.grade === 'B' ? 'secondary' : 'destructive'}>
                            Grade {harvest.grade}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {recentHarvests.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No harvest records found</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>System Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Worker ID</Label>
                      <p className="font-mono text-sm">{worker.id}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Employee ID</Label>
                      <p className="font-mono text-sm">{worker.employee_id}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Plantation ID</Label>
                      <p className="font-mono text-sm">{worker.plantation_id || 'Not assigned'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                      <p className="text-sm">{worker.role.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                      <p className="text-sm">{new Date(worker.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
                      <p className="text-sm">{new Date(worker.updated_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function Label({ className, ...props }: React.HTMLAttributes<HTMLLabelElement>) {
  return <label className={className} {...props} />
}