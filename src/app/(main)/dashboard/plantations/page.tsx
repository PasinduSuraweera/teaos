import { Metadata } from "next"
import { PlantationsManager } from "./_components/plantations-manager"

export const metadata: Metadata = {
  title: "Plantations Management",
  description: "Manage your tea plantation sites, view details, and track performance",
}

export default function PlantationsPage() {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <PlantationsManager />
    </div>
  )
}