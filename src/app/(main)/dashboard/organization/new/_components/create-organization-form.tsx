"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useOrganization } from "@/contexts/organization-context"
import { toast } from "sonner"

export function CreateOrganizationForm() {
  const router = useRouter()
  const { createOrganization } = useOrganization()
  const [orgName, setOrgName] = useState("")
  const [creating, setCreating] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!orgName.trim()) {
      toast.error("Please enter an organization name")
      return
    }

    setCreating(true)
    try {
      const orgId = await createOrganization(orgName.trim())
      
      if (orgId) {
        toast.success("Organization created successfully!")
        router.push('/dashboard')
      } else {
        toast.error("Failed to create organization. Please try again.")
      }
    } catch (error: any) {
      console.error('Error creating organization:', error)
      toast.error(error?.message || "Failed to create organization")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold">Create Organization</h2>
        </div>
      </div>

      {/* Create Organization Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">New Organization</CardTitle>
              <CardDescription className="text-xs">
                Create your own workspace to manage your team
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                placeholder="Acme Tea Estates"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={creating}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Choose a name for your workspace. You can change it later in settings.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating || !orgName.trim()}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Organization"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
