'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignInPage() {
    const router = useRouter()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleLogin = async (e?: React.FormEvent) => {
        e?.preventDefault()
        setLoading(true)
        setError('')

        const { data: authData, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        if (!authData?.user) {
            setLoading(false)
            return
        }

        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', authData.user.id)
            .single()

        setLoading(false)

        if (userData?.role === 'admin') {
            router.push('/admin')
        } else {
            router.push('/')
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#fffbf7] px-4 py-10">

            <div className="w-full max-w-md rounded-2xl border border-[#e8e0e7] bg-white p-7 shadow-[0_18px_55px_rgba(126,106,168,0.12)] sm:p-10">

                {/* Brand */}
                <img src="/images/logo/craftoo-logo.png" alt="Craftoo" className="mx-auto h-16 w-44 object-contain mix-blend-multiply" />
                <p className="mt-4 text-center font-syndicatgrotesk text-[10px] font-semibold tracking-[0.24em] text-[#7e6aa8] uppercase">
                    Welcome back
                </p>
                <h1 className="mt-2 text-center font-brandon text-3xl font-bold text-[#403a38]">Sign in to Craftoo</h1>
                <p className="mt-2 mb-8 text-center font-syndicatgrotesk text-sm text-[#756e6b]">Pick up where your thoughtful gifting left off.</p>

                <form onSubmit={handleLogin}>
                {/* Email */}
                <div className="mb-4">
                    <label className="font-syndicatgrotesk text-[10px] font-semibold uppercase tracking-[0.18em] text-[#756e6b]">
                        Email
                    </label>

                    <input
                        type="email"
                        name="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-[#e8e0e7] bg-[#fffbf7] px-3 text-sm text-[#403a38] placeholder:text-[#a39b9c] focus:border-[#b5a1d2] focus:outline-none focus:ring-4 focus:ring-[#e8ddf2]/60"
                    />
                </div>

                {/* Password */}
                <div className="mb-6">
                    <label className="font-syndicatgrotesk text-[10px] font-semibold uppercase tracking-[0.18em] text-[#756e6b]">
                        Password
                    </label>

                    <input
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-[#e8e0e7] bg-[#fffbf7] px-3 text-sm text-[#403a38] placeholder:text-[#a39b9c] focus:border-[#b5a1d2] focus:outline-none focus:ring-4 focus:ring-[#e8ddf2]/60"
                    />
                </div>
                {error && (
                    <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-center font-syndicatgrotesk text-sm text-red-600">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-full bg-[#7e6aa8] py-3.5 font-syndicatgrotesk text-[10px] font-bold tracking-[0.2em] text-white uppercase shadow-[0_8px_20px_rgba(126,106,168,0.2)] transition hover:bg-[#67548e] disabled:opacity-60"
                >
                    {loading ? 'Signing In...' : 'Sign In'}
                </button>
                </form>

                {/* Divider */}
                <div className="my-6 text-center font-syndicatgrotesk text-xs text-[#a39b9c]">or</div>

                {/* Sign up link */}
                <p className="text-center font-syndicatgrotesk text-sm text-[#756e6b]">
                    Don’t have an account?{' '}
                    <a href="/signup" className="font-semibold text-[#7e6aa8] hover:underline">
                        Create one
                    </a>
                </p>

            </div>
        </div>
    )
}
