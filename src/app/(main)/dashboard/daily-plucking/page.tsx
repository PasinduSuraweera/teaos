import { Metadata } from "next"
import { DailyPluckingManager } from "./_components/daily-plucking-manager"

export const metadata: Metadata = {
  title: "Daily Records",
  description: "Record daily tea harvest data and wages for workers",
}

export default function DailyPluckingPage() {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <DailyPluckingManager />
    </div>
  )
}