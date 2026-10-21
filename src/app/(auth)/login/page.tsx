'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/greenmag-logo.png" alt="GreenMag" style={{height: '48px', width: 'auto', marginBottom: '12px'}} />
          <p className="text-sm text-[var(--muted-foreground)]">Sign in to your account</p>
        </div>
        {/* Form */}
        <div className="card p-6">
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Input label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@energy.aau.dk" required autoComplete="email" />
            <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required autoComplete="current-password" />
            {error && (<p className="text-sm text-[var(--destructive)] bg-red-50 px-3 py-2 rounded-md">{error}</p>)}
            <Button type="submit" loading={loading} className="w-full mt-1">Sign in</Button>
          </form>
        </div>
        <p className="text-center text-xs text-[var(--muted-foreground)] mt-4">
          Access is by invitation only. Contact your administrator.
        </p>
      </div>
    </div>
  )
}
