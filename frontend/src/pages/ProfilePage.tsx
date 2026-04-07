import { useState } from 'react'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface Props {
  user: User
}

export default function ProfilePage({ user }: Props) {
  // ── Display name ──────────────────────────────────────────────
  const initialName = (user.user_metadata?.full_name as string | undefined) ?? ''
  const [displayName, setDisplayName] = useState(initialName)
  const [savingName, setSavingName] = useState(false)

  const handleSaveName = async () => {
    setSavingName(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: displayName.trim() } })
    setSavingName(false)
    if (error) {
      toast.error(`Failed to update name: ${error.message}`)
    } else {
      toast.success('Display name updated.')
    }
  }

  // ── Password ──────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const passwordError = (() => {
    if (newPassword && newPassword.length < 8) return 'New password must be at least 8 characters.'
    if (confirmPassword && newPassword !== confirmPassword) return 'Passwords do not match.'
    return null
  })()

  const canChangePassword =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !changingPassword

  const handleChangePassword = async () => {
    if (!canChangePassword) return
    setChangingPassword(true)
    try {
      // Verify current password by re-authenticating
      const email = user.email ?? ''
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (signInError) {
        toast.error('Current password is incorrect.')
        return
      }
      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        toast.error(`Failed to change password: ${updateError.message}`)
      } else {
        toast.success('Password changed successfully.')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto py-12 px-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-8">Profile</h1>

      {/* ── Account info ───────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl px-6 py-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Account</h2>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
          <input
            type="email"
            value={user.email ?? ''}
            readOnly
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-50 cursor-default"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleSaveName}
          disabled={savingName || displayName.trim() === initialName}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {savingName ? 'Saving…' : 'Save name'}
        </button>
      </section>

      {/* ── Change password ─────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl px-6 py-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Change Password</h2>

        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {passwordError && (
          <p className="text-xs text-red-600 mb-3">{passwordError}</p>
        )}

        <button
          onClick={handleChangePassword}
          disabled={!canChangePassword}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {changingPassword ? 'Changing…' : 'Change password'}
        </button>
      </section>
    </div>
  )
}
