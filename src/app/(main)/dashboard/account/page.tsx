import { Metadata } from "next"
import { AccountManager } from "./_components/account-manager"

export const metadata: Metadata = {
  title: "Account Settings",
  description: "Manage your account settings and profile",
}

export default function AccountPage() {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <AccountManager />
    </div>
  )
}
