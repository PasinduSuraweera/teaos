"use server"

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Email sending function - uses Resend if configured, otherwise just logs
export async function sendInviteEmail(
  toEmail: string,
  organizationName: string,
  inviteLink: string,
  inviterName?: string
): Promise<{ success: boolean; error?: string }> {
  
  const resendApiKey = process.env.RESEND_API_KEY
  
  if (!resendApiKey) {
    // No email service configured - just log it
    console.log('=== INVITE EMAIL (no email service configured) ===')
    console.log('To:', toEmail)
    console.log('Organization:', organizationName)
    console.log('Link:', inviteLink)
    console.log('===============================================')
    return { success: true }
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
        to: toEmail,
        subject: `You've been invited to join ${organizationName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been invited!</h2>
            <p>${inviterName ? `${inviterName} has` : 'You have been'} invited you to join <strong>${organizationName}</strong> on Tea Dashboard.</p>
            <p style="margin: 30px 0;">
              <a href="${inviteLink}" 
                 style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Accept Invitation
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">
              Or copy this link: <a href="${inviteLink}">${inviteLink}</a>
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 40px;">
              This invitation will expire in 7 days.
            </p>
          </div>
        `,
      }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      console.error('Resend error:', error)
      return { success: false, error: error.message || 'Failed to send email' }
    }
    
    return { success: true }
  } catch (error: any) {
    console.error('Email send error:', error)
    return { success: false, error: error.message || 'Failed to send email' }
  }
}

// Get the base URL for invite links
export async function getBaseUrl(): Promise<string> {
  // In production, use the NEXT_PUBLIC_APP_URL or VERCEL_URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  // Fallback for development
  return 'http://localhost:3000'
}
