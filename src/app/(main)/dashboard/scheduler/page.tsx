import { Metadata } from "next"
import { SchedulerManager } from "./_components/scheduler-manager"

export const metadata: Metadata = {
  title: "Scheduler",
  description: "Schedule and manage plantation tasks and events",
}

export default function SchedulerPage() {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <SchedulerManager />
    </div>
  )
}
