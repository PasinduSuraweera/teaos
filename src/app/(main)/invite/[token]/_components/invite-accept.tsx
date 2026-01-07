"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Building2, Check, X, Loader2, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase"
import { OrganizationRole } from "@/types/database"
import { toast } from "sonner"
import Link from "next/link"

interface InviteDetails {
  id: string
  email: string
  role: OrganizationRole
  expires_at: string
  organization_id: string
  organization_name: string
}

interface InviteAcceptProps {
  token: string
}

export function InviteAccept({ token }: InviteAcceptProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)

  // Listen for auth state changes
  useEffect(() => {
    // Check initial auth state
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setAuthChecked(true)
    })
    
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      setAuthChecked(true)
    })
    
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    fetchInviteDetails()
  }, [token])

  async function fetchInviteDetails() {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select(`
          id,
          email,
          role,
          expires_at,
          organization_id,
          organizations (name)
        `)
        .eq('token', token)
        .is('accepted_at', null)
        .single()

      if (error || !data) {
        setError("This invitation is invalid or has expired.")
        return
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        setError("This invitation has expired.")
        return
      }

      setInvite({
        id: data.id,
        email: data.email,
        role: data.role,
        expires_at: data.expires_at,
        organization_id: data.organization_id,
        organization_name: (data.organizations as any)?.name || 'Unknown Organization',
      })
    } catch (err) {
      console.error('Error fetching invite:', err)
      setError("Failed to load invitation details.")
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept() {
    if (!invite || !user) {
      toast.error("Please log in first")
      return
    }

    console.log('Accepting invitation...')
    console.log('User:', user.id, user.email)
    console.log('Invite:', invite)
    console.log('Token:', token)

    // Check if user email matches invitation
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      toast.error(`You must be logged in with ${invite.email}. Currently logged in as ${user.email}`)
      return
    }

    setAccepting(true)
    try {
      // Use the SECURITY DEFINER function to accept invitation
      console.log('Calling accept_invitation RPC with token:', token)
      const { data, error } = await supabase.rpc('accept_invitation', {
        p_token: token
      })

      console.log('RPC response - data:', data, 'error:', error)

      if (error) {
        console.error('Accept invitation error:', JSON.stringify(error, null, 2))
        throw error
      }

      if (!data || !data.organization_id) {
        console.error('No data returned from accept_invitation')
        throw new Error('Failed to accept invitation - no response')
      }

      console.log('Invitation accepted:', data)
      toast.success("You've joined the organization!")
      
      // Store the new org as current
      localStorage.setItem('current_organization_id', data.organization_id)
      
      // Redirect to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      console.error('Error accepting invitation:', err)
      toast.error(err.message || "Failed to accept invitation")
    } finally {
      setAccepting(false)
    }
  }

  // Wait for both invite details AND auth state to be checked
  if (loading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <X className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>You're Invited!</CardTitle>
            <CardDescription>
              You've been invited to join <strong>{invite?.organization_name}</strong>.
              Please sign in or create an account to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link href={`/auth/v1/login?redirect=/invite/${token}`}>
                Sign In
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/auth/v1/register?redirect=/invite/${token}&email=${encodeURIComponent(invite?.email || '')}`}>
                Create Account
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Join Organization</CardTitle>
          <CardDescription>
            You've been invited to join <strong>{invite?.organization_name}</strong> as a <strong className="capitalize">{invite?.role}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>Logged in as: <strong>{user.email}</strong></p>
          {user.email?.toLowerCase() !== invite?.email.toLowerCase() && (
            <p className="text-destructive mt-2">
              This invitation was sent to <strong>{invite?.email}</strong>. 
              Please sign in with that email address.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => router.push('/')}
          >
            Decline
          </Button>
          <Button 
            className="flex-1"
            onClick={handleAccept}
            disabled={accepting || user.email?.toLowerCase() !== invite?.email.toLowerCase()}
          >
            {accepting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Accept & Join
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
