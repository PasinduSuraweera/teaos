import { redirect } from "next/navigation"

export default function Page() {
  // Redirect to default dashboard
  redirect("/dashboard/default")
}
