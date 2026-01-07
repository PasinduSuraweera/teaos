"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { useDataTableInstance } from "@/hooks/use-data-table-instance"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { Checkbox } from "@/components/ui/checkbox"
import { CircleCheck, Loader } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface Task {
  id: number
  header: string
  type: string
  status: string
  target: string
  limit: string
  reviewer: string
  created_at?: string
}

const taskTypes = [
  "Daily Task",
  "Data Entry", 
  "Quality Control",
  "Logistics",
  "Maintenance",
  "Finance",
  "Plantation Care",
  "Reporting"
]

const taskStatuses = [
  "Done",
  "In Process", 
  "Pending",
  "Scheduled"
]

const columns: ColumnDef<Task>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "header",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Task" />,
  },
  {
    accessorKey: "type",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Task Type" />,
    cell: ({ row }) => (
      <Badge variant="secondary">{row.getValue("type")}</Badge>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const status = row.original.status
      return (
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          {status === "Done" ? (
            <CircleCheck className="stroke-border fill-green-500 dark:fill-green-400 mr-1 h-3 w-3" />
          ) : status === "In Process" ? (
            <Loader className="mr-1 h-3 w-3" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-orange-500 mr-1" />
          )}
          {status}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: "target",
    header: ({ column }) => <DataTableColumnHeader className="w-full text-right" column={column} title="Target Time" />,
  },
  {
    accessorKey: "limit",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Limit" />,
  },
  {
    accessorKey: "reviewer",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Reviewer" />,
  },
]

export function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [formData, setFormData] = useState({
    header: '',
    type: '',
    status: '',
    target: '',
    limit: '',
    reviewer: ''
  })

  useEffect(() => {
    fetchTasks()
  }, [])

  async function fetchTasks() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('estate_tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching tasks:', error)
        if (error.message?.includes('relation "estate_tasks" does not exist')) {
          setTableExists(false)
          setLoading(false)
          return
        }
        // For other errors, show them to user
        alert('Error loading tasks: ' + error.message)
        return
      }

      setTasks(data || [])
      setTableExists(true)
    } catch (error) {
      console.error('Error processing tasks:', error)
      alert('Failed to load tasks. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  async function setupTableWithSampleData() {
    try {
      setLoading(true)
      const response = await fetch('/api/setup-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const result = await response.json()
      
      if (response.ok) {
        if (result.success) {
          setTableExists(true)
          await fetchTasks()
          alert(result.message)
        }
      } else {
        console.error('Setup failed:', result)
        if (result.sql && result.instructions) {
          // Show table creation instructions
          const message = `${result.error}\n\nPlease:\n${result.instructions.join('\n')}\n\nSQL to run:\n${result.sql}`
          alert(message)
        } else {
          alert(result.error || 'Setup failed. Please check the console for details.')
        }
      }
    } catch (error) {
      console.error('Error setting up table:', error)
      alert('Failed to setup table. Please check your network connection and Supabase configuration.')
    } finally {
      setLoading(false)
    }
  }

  async function insertSampleTasks() {
    const sampleTasks = [
      {
        header: "Morning Inspection",
        type: "Daily Task",
        status: "Done",
        target: "08:00",
        limit: "09:00",
        reviewer: "Estate Manager"
      },
      {
        header: "Worker Assignment", 
        type: "Daily Task",
        status: "Done",
        target: "08:30",
        limit: "09:00",
        reviewer: "Field Supervisor"
      },
      {
        header: "Tea Plucking Records",
        type: "Data Entry",
        status: "In Process",
        target: "18:00", 
        limit: "20:00",
        reviewer: "Estate Manager"
      },
      {
        header: "Quality Check",
        type: "Quality Control",
        status: "Done",
        target: "16:00",
        limit: "17:00", 
        reviewer: "Quality Inspector"
      },
      {
        header: "Equipment Maintenance",
        type: "Maintenance", 
        status: "Pending",
        target: "14:00",
        limit: "16:00",
        reviewer: "Maintenance Team"
      }
    ]

    try {
      await supabase.from('estate_tasks').insert(sampleTasks)
    } catch (error) {
      console.error('Error inserting sample tasks:', error)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      if (editingTask) {
        // Update existing task
        const { error } = await supabase
          .from('estate_tasks')
          .update(formData)
          .eq('id', editingTask.id)

        if (error) throw error
        setEditingTask(null)
      } else {
        // Create new task
        const { error } = await supabase
          .from('estate_tasks')
          .insert(formData)

        if (error) throw error
        setIsAddDialogOpen(false)
      }

      setFormData({
        header: '',
        type: '',
        status: '',
        target: '',
        limit: '',
        reviewer: ''
      })

      fetchTasks()
    } catch (error) {
      console.error('Error saving task:', error)
      alert('Error saving task. Please try again.')
    }
  }

  async function handleDelete(taskId: number) {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      const { error } = await supabase
        .from('estate_tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error
      fetchTasks()
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Error deleting task. Please try again.')
    }
  }

  function startEdit(task: Task) {
    setEditingTask(task)
    setFormData({
      header: task.header,
      type: task.type,
      status: task.status,
      target: task.target,
      limit: task.limit,
      reviewer: task.reviewer
    })
  }

  function cancelEdit() {
    setEditingTask(null)
    setFormData({
      header: '',
      type: '',
      status: '',
      target: '',
      limit: '',
      reviewer: ''
    })
  }

  const enhancedColumns: ColumnDef<Task>[] = [
    ...columns,
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => startEdit(row.original)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(row.original.id)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const table = useDataTableInstance({
    data: tasks,
    columns: enhancedColumns,
    getRowId: (row) => row.id.toString(),
  })

  if (!tableExists) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estate Task Management</h1>
          <p className="text-muted-foreground">Manage daily operations and track task completion</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Database Setup Required</CardTitle>
            <CardDescription>
              To use the task management system, we need to create the estate_tasks table in your database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <h4 className="font-medium mb-2 text-blue-900 dark:text-blue-100">Quick Setup (Recommended)</h4>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                Click the button below to automatically create the table and add sample data.
              </p>
              <Button onClick={setupTableWithSampleData} disabled={loading}>
                {loading ? 'Setting up...' : 'Auto Setup Table & Sample Data'}
              </Button>
            </div>
            
            <div className="border-t pt-4">
              <details className="group">
                <summary className="font-medium cursor-pointer text-sm hover:text-primary">
                  Manual Setup Instructions (Advanced)
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium mb-2">SQL to create the table:</h4>
                    <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
{`CREATE TABLE estate_tasks (
  id SERIAL PRIMARY KEY,
  header VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  target VARCHAR(100) NOT NULL,
  "limit" VARCHAR(100) NOT NULL,
  reviewer VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`}
                    </pre>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Manual Steps:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Go to your Supabase dashboard</li>
                      <li>Navigate to the SQL Editor</li>
                      <li>Paste the SQL above and run it</li>
                      <li>Refresh this page</li>
                    </ol>
                  </div>
                </div>
              </details>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Check Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estate Task Management</h1>
          <p className="text-muted-foreground">Manage daily operations and track task completion</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Task</DialogTitle>
              <DialogDescription>
                Create a new task for estate operations
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="header">Task Name *</Label>
                <Input
                  id="header"
                  value={formData.header}
                  onChange={(e) => setFormData({...formData, header: e.target.value})}
                  placeholder="Enter task name"
                  required
                />
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="type">Task Type *</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {taskTypes.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {taskStatuses.map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="target">Target Time *</Label>
                  <Input
                    id="target"
                    value={formData.target}
                    onChange={(e) => setFormData({...formData, target: e.target.value})}
                    placeholder="e.g., 08:00 or Weekly"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="limit">Deadline *</Label>
                  <Input
                    id="limit"
                    value={formData.limit}
                    onChange={(e) => setFormData({...formData, limit: e.target.value})}
                    placeholder="e.g., 09:00 or Friday"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reviewer">Reviewer *</Label>
                <Input
                  id="reviewer"
                  value={formData.reviewer}
                  onChange={(e) => setFormData({...formData, reviewer: e.target.value})}
                  placeholder="Person responsible"
                  required
                />
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Task</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Task Dialog */}
      {editingTask && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Edit Task</CardTitle>
            <CardDescription>Update task details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-header">Task Name *</Label>
                <Input
                  id="edit-header"
                  value={formData.header}
                  onChange={(e) => setFormData({...formData, header: e.target.value})}
                  placeholder="Enter task name"
                  required
                />
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Task Type *</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {taskTypes.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {taskStatuses.map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-target">Target Time *</Label>
                  <Input
                    id="edit-target"
                    value={formData.target}
                    onChange={(e) => setFormData({...formData, target: e.target.value})}
                    placeholder="e.g., 08:00 or Weekly"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-limit">Deadline *</Label>
                  <Input
                    id="edit-limit"
                    value={formData.limit}
                    onChange={(e) => setFormData({...formData, limit: e.target.value})}
                    placeholder="e.g., 09:00 or Friday"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-reviewer">Reviewer *</Label>
                <Input
                  id="edit-reviewer"
                  value={formData.reviewer}
                  onChange={(e) => setFormData({...formData, reviewer: e.target.value})}
                  placeholder="Person responsible"
                  required
                />
              </div>
              
              <div className="flex gap-2">
                <Button type="submit">
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Estate Tasks</CardTitle>
          <CardDescription>Daily operations and task tracking</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length > 0 ? (
            <DataTable table={table} columns={enhancedColumns} />
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No tasks found. Add your first task to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}