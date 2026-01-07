"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { X, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { WorkerWithPlantation, PlantationBasic } from "@/types/database"
import { toast } from "sonner"

const workerSchema = z.object({
  employee_id: z.string().min(3, "Employee ID must be at least 3 characters"),
  first_name: z.string().min(2, "First name must be at least 2 characters"),
  last_name: z.string().min(2, "Last name must be at least 2 characters"),
  phone: z.string().optional(),
  role: z.enum(["picker", "supervisor", "manager", "quality_controller"]),
  plantation_id: z.string().optional(),
  hire_date: z.string().optional(),
  salary: z.number().positive("Salary must be positive").optional(),
  status: z.enum(["active", "inactive", "terminated"]),
})

type WorkerFormData = z.infer<typeof workerSchema>

interface WorkerFormProps {
  worker?: WorkerWithPlantation | null
  onClose: () => void
}

export function WorkerForm({ worker, onClose }: WorkerFormProps) {
  const [loading, setLoading] = useState(false)
  const [plantations, setPlantations] = useState<PlantationBasic[]>([])
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<WorkerFormData>({
    resolver: zodResolver(workerSchema),
    defaultValues: {
      employee_id: worker?.employee_id || "",
      first_name: worker?.first_name || "",
      last_name: worker?.last_name || "",
      phone: worker?.phone || "",
      role: worker?.role || "picker",
      plantation_id: worker?.plantation_id || "unassigned",
      hire_date: worker?.hire_date || "",
      salary: worker?.salary || undefined,
      status: worker?.status || "active",
    },
  })

  useEffect(() => {
    fetchPlantations()
  }, [])

  const fetchPlantations = async () => {
    try {
      const { data, error } = await supabase
        .from('plantations')
        .select('id, name, location')
        .eq('status', 'active')
        .order('name')

      if (error) throw error
      setPlantations(data || [])
    } catch (error) {
      console.error('Error fetching plantations:', error)
    }
  }

  const onSubmit = async (data: WorkerFormData) => {
    setLoading(true)
    
    try {
      // Clean up empty strings
      const cleanData = {
        ...data,
        phone: data.phone || null,
        plantation_id: data.plantation_id === "unassigned" ? null : data.plantation_id || null,
        hire_date: data.hire_date || null,
        salary: data.salary || null,
      }

      if (worker) {
        // Update existing worker
        const { error } = await supabase
          .from('workers')
          .update(cleanData)
          .eq('id', worker.id)
        
        if (error) throw error
        toast.success("Worker updated successfully")
      } else {
        // Create new worker
        const { error } = await supabase
          .from('workers')
          .insert([cleanData])
        
        if (error) throw error
        toast.success("Worker created successfully")
      }
      
      onClose()
    } catch (error: any) {
      console.error('Error saving worker:', error)
      toast.error(error.message || "Failed to save worker")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{worker ? 'Edit Worker' : 'Add New Worker'}</CardTitle>
              <CardDescription>
                {worker ? 'Update worker details' : 'Add a new worker to your plantation workforce'}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="employee_id">Employee ID *</Label>
                <Input
                  id="employee_id"
                  {...register("employee_id")}
                  placeholder="EMP001"
                />
                {errors.employee_id && (
                  <p className="text-sm text-destructive">{errors.employee_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  onValueChange={(value) => setValue("role", value as any)}
                  defaultValue={watch("role")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="picker">Picker</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="quality_controller">Quality Controller</SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-sm text-destructive">{errors.role.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  {...register("first_name")}
                  placeholder="Saman"
                />
                {errors.first_name && (
                  <p className="text-sm text-destructive">{errors.first_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  {...register("last_name")}
                  placeholder="Perera"
                />
                {errors.last_name && (
                  <p className="text-sm text-destructive">{errors.last_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  {...register("phone")}
                  placeholder="+94771234567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plantation_id">Plantation</Label>
                <Select
                  onValueChange={(value) => setValue("plantation_id", value)}
                  defaultValue={watch("plantation_id")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select plantation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {plantations.map((plantation) => (
                      <SelectItem key={plantation.id} value={plantation.id}>
                        {plantation.name} - {plantation.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hire_date">Hire Date</Label>
                <Input
                  id="hire_date"
                  type="date"
                  {...register("hire_date")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="salary">Monthly Salary (LKR)</Label>
                <Input
                  id="salary"
                  type="number"
                  step="100"
                  {...register("salary", { valueAsNumber: true })}
                  placeholder="50000"
                />
                {errors.salary && (
                  <p className="text-sm text-destructive">{errors.salary.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  onValueChange={(value) => setValue("status", value as any)}
                  defaultValue={watch("status")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                {worker ? 'Update' : 'Create'} Worker
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}