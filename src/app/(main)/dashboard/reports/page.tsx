import { Metadata } from "next"
import { ReportsManager } from "./_components/reports-manager"

export const metadata: Metadata = {
  title: "PDF Reports",
  description: "Generate and download PDF reports",
}

export default function ReportsPage() {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <ReportsManager />
    </div>
  )
}
