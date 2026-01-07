"use client"

import { useState, useEffect, useMemo } from "react"
import { Plus, Search, Calendar, Clock, Trash2, Edit, Check, X, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns"
import { toast } from "sonner"
import { useOrganization } from "@/contexts/organization-context"

interface ScheduleEvent {
  id: string
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  event_type: 'task' | 'reminder' | 'meeting' | 'harvest' | 'maintenance'
  status: 'pending' | 'completed' | 'cancelled'
  created_at: string
}

const EVENT_TYPES = [
  { value: 'task', label: 'Task', color: 'bg-blue-500' },
  { value: 'reminder', label: 'Reminder', color: 'bg-yellow-500' },
  { value: 'meeting', label: 'Meeting', color: 'bg-purple-500' },
  { value: 'harvest', label: 'Harvest', color: 'bg-green-500' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-orange-500' },
]

export function SchedulerManager() {
  const { currentOrganization, loading: orgLoading } = useOrganization()
  const orgId = currentOrganization?.organization_id
  
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formDate, setFormDate] = useState("")
  const [formTime, setFormTime] = useState("")
  const [formType, setFormType] = useState<string>("task")

  useEffect(() => {
    if (orgId) {
      fetchEvents()
    }
  }, [currentMonth, orgId])

  async function fetchEvents() {
    if (!orgId) return
    setLoading(true)
    try {
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

      const { data, error } = await supabase
        .from('schedule_events')
        .select('*')
        .eq('organization_id', orgId)
        .gte('event_date', monthStart)
        .lte('event_date', monthEnd)
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true })

      if (error) {
        // Fallback if organization_id column doesn't exist
        if (error.message?.includes('organization_id') || error.code === '42703') {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('schedule_events')
            .select('*')
            .gte('event_date', monthStart)
            .lte('event_date', monthEnd)
            .order('event_date', { ascending: true })
            .order('event_time', { ascending: true })
          
          if (fallbackError) {
            if (fallbackError.message?.includes('does not exist')) {
              setEvents([])
              return
            }
            throw fallbackError
          }
          setEvents(fallbackData || [])
          return
        }
        if (error.message?.includes('does not exist')) {
          // Table doesn't exist yet
          setEvents([])
          return
        }
        throw error
      }

      setEvents(data || [])
    } catch (error) {
      console.error('Error fetching events:', error)
      toast.error("Failed to load events")
    } finally {
      setLoading(false)
    }
  }

  const handlePreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1))
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1))

  const handleAddEvent = (date?: Date) => {
    setEditingEvent(null)
    setFormTitle("")
    setFormDescription("")
    setFormDate(date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
    setFormTime("")
    setFormType("task")
    setShowEventDialog(true)
  }

  const handleEditEvent = (event: ScheduleEvent) => {
    setEditingEvent(event)
    setFormTitle(event.title)
    setFormDescription(event.description || "")
    setFormDate(event.event_date)
    setFormTime(event.event_time || "")
    setFormType(event.event_type)
    setShowEventDialog(true)
  }

  const handleSaveEvent = async () => {
    if (!formTitle.trim() || !formDate) {
      toast.error("Please fill in required fields")
      return
    }

    setSaving(true)
    try {
      const eventData = {
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        event_date: formDate,
        event_time: formTime || null,
        event_type: formType,
        status: 'pending' as const,
      }

      if (editingEvent) {
        const { error } = await supabase
          .from('schedule_events')
          .update(eventData)
          .eq('id', editingEvent.id)

        if (error) throw error
        toast.success("Event updated")
      } else {
        const { error } = await supabase
          .from('schedule_events')
          .insert([{ ...eventData, organization_id: orgId }])

        if (error) throw error
        toast.success("Event created")
      }

      setShowEventDialog(false)
      fetchEvents()
    } catch (error: any) {
      console.error('Error saving event:', error)
      if (error.message?.includes('schedule_events')) {
        toast.error("Events table not found. Please run the SQL setup.")
      } else {
        toast.error(error.message || "Failed to save event")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteEvent = async (event: ScheduleEvent) => {
    if (!confirm(`Delete "${event.title}"?`)) return

    try {
      const { error } = await supabase
        .from('schedule_events')
        .delete()
        .eq('id', event.id)

      if (error) throw error
      toast.success("Event deleted")
      fetchEvents()
    } catch (error: any) {
      console.error('Error deleting event:', error)
      toast.error(error.message || "Failed to delete event")
    }
  }

  const handleToggleStatus = async (event: ScheduleEvent) => {
    const newStatus = event.status === 'completed' ? 'pending' : 'completed'
    
    try {
      const { error } = await supabase
        .from('schedule_events')
        .update({ status: newStatus })
        .eq('id', event.id)

      if (error) throw error
      fetchEvents()
    } catch (error: any) {
      console.error('Error updating status:', error)
      toast.error("Failed to update status")
    }
  }

  // Calendar days
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start, end })
    
    // Add padding days for the first week
    const startDay = start.getDay()
    const paddingDays = Array(startDay).fill(null)
    
    return [...paddingDays, ...days]
  }, [currentMonth])

  // Events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>()
    events.forEach(event => {
      const dateKey = event.event_date
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey)!.push(event)
    })
    return map
  }, [events])

  // Filtered events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return events
    const dateKey = format(selectedDate, 'yyyy-MM-dd')
    return eventsByDate.get(dateKey) || []
  }, [selectedDate, eventsByDate, events])

  if (orgLoading || !orgId) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading organization...</span>
      </div>
    )
  }

  if (loading && events.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading scheduler...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold">Scheduler</h2>
          <Button onClick={() => handleAddEvent()} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add Event</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handlePreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                <div 
                  key={day} 
                  className={`text-center text-xs font-medium text-muted-foreground py-2 ${
                    index < 6 ? 'border-r border-border' : ''
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 border-l border-border">
              {calendarDays.map((day, index) => {
                const isLastInRow = (index + 1) % 7 === 0
                const rowNumber = Math.floor(index / 7)
                
                if (!day) {
                  return (
                    <div 
                      key={`empty-${index}`} 
                      className={`min-h-[48px] sm:min-h-[70px] border-r border-b border-border bg-muted/20`}
                    />
                  )
                }
                
                const dateKey = format(day, 'yyyy-MM-dd')
                const dayEvents = eventsByDate.get(dateKey) || []
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const isCurrentMonth = isSameMonth(day, currentMonth)
                
                return (
                  <button
                    key={dateKey}
                    onClick={() => setSelectedDate(isSelected ? null : day)}
                    className={`
                      min-h-[48px] sm:min-h-[70px] p-0.5 sm:p-1 text-sm relative transition-colors border-r border-b border-border text-left flex flex-col
                      ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}
                      ${!isCurrentMonth ? 'text-muted-foreground/50 bg-muted/20' : ''}
                      ${isToday(day) && !isSelected ? 'bg-primary/10' : ''}
                    `}
                  >
                    <span className={`text-[10px] sm:text-xs mb-0.5 sm:mb-1 ${isToday(day) ? 'font-bold' : ''}`}>
                      {format(day, 'd')}
                    </span>
                    <div className="flex-1 overflow-hidden space-y-0.5 hidden sm:block">
                      {dayEvents.slice(0, 2).map((event, i) => (
                        <div key={i} className="flex items-center gap-1 min-w-0">
                          <div
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              EVENT_TYPES.find(t => t.value === event.event_type)?.color || 'bg-gray-500'
                            }`}
                          />
                          <span className="text-[10px] truncate leading-tight">{event.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</span>
                      )}
                    </div>
                    {/* Mobile: just show dots */}
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 mt-auto sm:hidden">
                        {dayEvents.slice(0, 3).map((event, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${
                              EVENT_TYPES.find(t => t.value === event.event_type)?.color || 'bg-gray-500'
                            }`}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[8px] text-muted-foreground">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Events List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'All Events'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {selectedDateEvents.length} {selectedDateEvents.length === 1 ? 'event' : 'events'}
                  {selectedDate && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 ml-2 text-xs"
                      onClick={() => setSelectedDate(null)}
                    >
                      Show all
                    </Button>
                  )}
                </CardDescription>
              </div>
              {selectedDate && (
                <Button size="sm" variant="outline" className="h-7" onClick={() => handleAddEvent(selectedDate)}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {selectedDateEvents.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No events</p>
                {selectedDate && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => handleAddEvent(selectedDate)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Event
                  </Button>
                )}
              </div>
            ) : (
              selectedDateEvents.map(event => (
                <div
                  key={event.id}
                  className={`p-3 rounded-lg border ${
                    event.status === 'completed' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            EVENT_TYPES.find(t => t.value === event.event_type)?.color || 'bg-gray-500'
                          }`}
                        />
                        <span className={`font-medium text-sm truncate ${
                          event.status === 'completed' ? 'line-through' : ''
                        }`}>
                          {event.title}
                        </span>
                      </div>
                      {event.event_time && (
                        <p className="text-xs text-muted-foreground mt-1 ml-4">
                          {event.event_time}
                        </p>
                      )}
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1 ml-4 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleToggleStatus(event)}
                      >
                        <Check className={`h-3 w-3 ${event.status === 'completed' ? 'text-green-500' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleEditEvent(event)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() => handleDeleteEvent(event)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Modal */}
      {showEventDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{editingEvent ? 'Edit Event' : 'Add Event'}</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowEventDialog(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); handleSaveEvent(); }} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-xs">Title *</Label>
                  <Input
                    id="title"
                    placeholder="Event title"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="h-8"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="date" className="text-xs">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="h-8"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="time" className="text-xs">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="h-8"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="type" className="text-xs">Type</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${type.color}`} />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Optional description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowEventDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    {editingEvent ? 'Update' : 'Create'}
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
