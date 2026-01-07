import { Metadata } from "next"
import { WorkersManager } from "./_components/workers-manager"

export const metadata: Metadata = {
  title: "Workers Management",
  description: "Manage your plantation workforce, track performance, and handle employee records",
}

export default function WorkersPage() {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <WorkersManager />
    </div>
  )
}