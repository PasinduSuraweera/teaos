"use client"

import { useState, useRef } from "react"
import { Camera, Loader2, Save, User } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/use-auth"
import { createBrowserSupabaseClient } from "@/lib/supabase"
import { getInitials } from "@/lib/utils"
import { toast } from "sonner"

export function AccountManager() {
  const { user, loading: authLoading } = useAuth()
  const supabase = createBrowserSupabaseClient()
  
  const [fullName, setFullName] = useState("")
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize state from user data
  useState(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || "")
      setAvatarUrl(user.user_metadata?.avatar_url || null)
    }
  })

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"
  const displayEmail = user?.email || ""
  const currentAvatarUrl = avatarUrl || user?.user_metadata?.avatar_url || null

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file")
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB")
      return
    }

    setUploading(true)

    try {
      // Create a unique file name
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      })

      if (updateError) throw updateError

      setAvatarUrl(publicUrl)
      toast.success("Profile photo updated")
    } catch (error: any) {
      console.error('Error uploading avatar:', error)
      toast.error(error.message || "Failed to upload photo")
    } finally {
      setUploading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) return

    setSaving(true)

    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      })

      if (error) throw error

      toast.success("Profile updated successfully")
    } catch (error: any) {
      console.error('Error updating profile:', error)
      toast.error(error.message || "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading account...</span>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-2">
        <User className="h-12 w-12 text-muted-foreground/30" />
        <span className="text-muted-foreground">Please sign in to view account settings</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl font-semibold">Account Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile and account preferences</p>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        {/* Profile Photo Card */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Profile Photo</CardTitle>
            <CardDescription className="text-xs">
              Click on the avatar to upload a new photo
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="relative group">
              <Avatar className="h-24 w-24 sm:h-32 sm:w-32 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <AvatarImage src={currentAvatarUrl || undefined} alt={displayName} className="object-cover" />
                <AvatarFallback className="text-2xl sm:text-3xl">{getInitials(displayName)}</AvatarFallback>
              </Avatar>
              <div 
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploading}
              />
            </div>
            <div className="text-center">
              <p className="font-medium">{displayName}</p>
              <p className="text-sm text-muted-foreground">{displayEmail}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full sm:w-auto"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  Change Photo
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              JPG, PNG or WebP. Max 2MB.
            </p>
          </CardContent>
        </Card>

        {/* Profile Details Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Profile Details</CardTitle>
            <CardDescription className="text-xs">
              Update your personal information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Enter your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={displayEmail}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Account ID</Label>
              <Input
                value={user.id}
                disabled
                className="bg-muted font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label>Member Since</Label>
              <Input
                value={new Date(user.created_at).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
