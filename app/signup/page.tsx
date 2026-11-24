'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SignUpPage() {
    const router = useRouter()

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const handleSignUp = async (e?: React.FormEvent) => {
        e?.preventDefault()
        setError('')
        setSuccess('')

        const fullName = name.trim()
        if (!fullName) {
            setError('Please enter your name')
            return
        }
        if (fullName.length > 120) {
            setError('Name must be 120 characters or fewer')
            return
        }
        if (!NAME_PATTERN.test(fullName)) {
            setError('Use letters, spaces, apostrophes, or hyphens in your name')
            return
        }

        const normalizedEmail = email.trim()
        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            setError('Enter a valid email address')
            return
        }

        const passwordIsComplex =
            password.length >= 8 &&
            /[a-z]/.test(password) &&
            /[A-Z]/.test(password) &&
            /\d/.test(password) &&
            /[^\p{L}\p{M}\p{N}\s]/u.test(password)
        if (!passwordIsComplex) {
            setError('Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol')
            return
        }

        setLoading(true)

        const { data, error } = await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: { data: { full_name: fullName } },
        })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        // With email confirmation on, Supabase does not reveal existing accounts as an error: it
        // returns a user with no identities instead.
        if (data.user && data.user.identities?.length === 0) {
            setError('An account with this email already exists. Sign in instead.')
            setLoading(false)
            return
        }

        // Supabase signs the new account in straight away (unless email confirmation is required),
        // so take the shopper where they were going instead of asking them to sign in again.
        if (data.session) {
            setSuccess('Account created! Taking you back to the store…')
            router.replace(getReturnTo() ?? '/')
            return
        }

        setSuccess('Account created! Check your email for a confirmation link, then sign in.')
        setLoading(false)
    }

    const getReturnTo = () => {
        const candidate = new URLSearchParams(window.location.search).get('returnTo')
        if (!candidate || !candidate.startsWith('/')) return null
        try {
            const target = new URL(candidate, window.location.origin)
            return target.origin === window.location.origin
                ? `${target.pathname}${target.search}${target.hash}`
                : null
        } catch {
            return null
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#fffbf7] px-4 py-10">

            <div className="w-full max-w-md rounded-2xl border border-[#e8e0e7] bg-white p-7 shadow-[0_18px_55px_rgba(126,106,168,0.12)] sm:p-10">

                {/* Brand */}
                <img src="/images/logo/craftoo-logo-round-256.png" alt="Craftoo" width={88} height={88} className="mx-auto h-[88px] w-[88px] object-contain drop-shadow-[0_8px_18px_rgba(126,106,168,0.18)]" />
                <p className="mt-4 text-center font-syndicatgrotesk text-[10px] font-semibold tracking-[0.24em] text-[#7e6aa8] uppercase">Made for thoughtful moments</p>
                <h1 className="mt-2 text-center font-brandon text-3xl font-bold text-[#403a38]">Create your account</h1>
                <p className="mt-2 mb-8 text-center font-syndicatgrotesk text-sm text-[#756e6b]">Save your favourites and make gifting easy.</p>

                <form onSubmit={handleSignUp}>
                {/* Name */}
                <div className="mb-4">
                    <label htmlFor="signup-name" className="font-syndicatgrotesk text-[10px] font-semibold uppercase tracking-[0.18em] text-[#756e6b]">
                        Name
                    </label>
                    <input
                        id="signup-name"
                        type="text"
                        name="name"
                        autoComplete="name"
                        maxLength={120}
                        required
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-[#e8e0e7] bg-[#fffbf7] px-3 text-sm text-[#403a38] placeholder:text-[#a39b9c] focus:border-[#b5a1d2] focus:outline-none focus:ring-4 focus:ring-[#e8ddf2]/60"
                    />
                    <p className="mt-1 text-xs text-[#8b8382]">Letters, spaces, apostrophes, and hyphens are allowed.</p>
                </div>

                {/* Email */}
                <div className="mb-4">
                    <label htmlFor="signup-email" className="font-syndicatgrotesk text-[10px] font-semibold uppercase tracking-[0.18em] text-[#756e6b]">
                        Email
                    </label>
                    <input
                        id="signup-email"
                        type="email"
                        name="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        maxLength={254}
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-[#e8e0e7] bg-[#fffbf7] px-3 text-sm text-[#403a38] placeholder:text-[#a39b9c] focus:border-[#b5a1d2] focus:outline-none focus:ring-4 focus:ring-[#e8ddf2]/60"
                    />
                </div>

                {/* Password */}
                <div className="mb-6">
                    <label htmlFor="signup-password" className="font-syndicatgrotesk text-[10px] font-semibold uppercase tracking-[0.18em] text-[#756e6b]">
                        Password
                    </label>
                    <input
                        id="signup-password"
                        type="password"
                        name="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        minLength={8}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        aria-describedby="signup-password-hint"
                        className="mt-2 h-11 w-full rounded-xl border border-[#e8e0e7] bg-[#fffbf7] px-3 text-sm text-[#403a38] placeholder:text-[#a39b9c] focus:border-[#b5a1d2] focus:outline-none focus:ring-4 focus:ring-[#e8ddf2]/60"
                    />
                    <p id="signup-password-hint" className="mt-1 text-xs leading-5 text-[#8b8382]">
                        At least 8 characters, including uppercase and lowercase letters, a number, and a symbol.
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-center font-syndicatgrotesk text-sm text-red-600">{error}</p>
                )}

                {/* Success */}
                {success && (
                    <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-center font-syndicatgrotesk text-sm text-green-700">{success}</p>
                )}

                {/* Button */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-full bg-[#7e6aa8] py-3.5 font-syndicatgrotesk text-[10px] font-bold tracking-[0.2em] text-white uppercase shadow-[0_8px_20px_rgba(126,106,168,0.2)] transition hover:bg-[#67548e] disabled:opacity-60"
                >
                    {loading ? 'Creating Account...' : 'Sign Up'}
                </button>
                </form>

                {/* Divider */}
                <div className="my-6 text-center font-syndicatgrotesk text-xs text-[#a39b9c]">
                    or
                </div>

                {/* Sign in link */}
                <p className="text-center font-syndicatgrotesk text-sm text-[#756e6b]">
                    Already have an account?{' '}
                    <a
                        href="/signin"
                        onClick={(event) => {
                            const returnTo = getReturnTo()
                            if (!returnTo) return
                            event.preventDefault()
                            router.push(`/signin?returnTo=${encodeURIComponent(returnTo)}`)
                        }}
                        className="font-semibold text-[#7e6aa8] hover:underline"
                    >
                        Sign in
                    </a>
                </p>
            </div>
        </div>
    )
}
