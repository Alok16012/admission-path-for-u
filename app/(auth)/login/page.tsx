'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

function InactiveErrorToast() {
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('error') === 'account_inactive') {
      toast.error('Your account has been deactivated. Please contact admin.')
    }
  }, [searchParams])
  return null
}

function LoginForm() {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData) {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      window.location.replace('/dashboard')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</Label>
        <Input
          id="email"
          type="email"
          placeholder="name@company.com"
          className="rounded-xl h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-shadow"
          {...register('email')}
          autoComplete="email"
        />
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
          <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
            Forgot password?
          </a>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          className="rounded-xl h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-shadow"
          {...register('password')}
          autoComplete="current-password"
        />
        {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
      </div>

      <div className="flex items-center">
        <input
          id="remember-me"
          name="remember-me"
          type="checkbox"
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer transition-colors"
        />
        <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 cursor-pointer">
          Remember me for 30 days
        </label>
      </div>

      <Button type="submit" className="w-full rounded-xl h-11 shadow-md bg-gray-900 hover:bg-black text-white transition-all font-semibold" disabled={loading}>
        {loading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        ) : (
          'Sign in'
        )}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <Card className="w-full max-w-5xl shadow-2xl overflow-hidden border-none mx-4">
      <Suspense fallback={null}>
        <InactiveErrorToast />
      </Suspense>
      <div className="flex flex-col md:flex-row min-h-[600px]">
        {/* Left Side - Brand & Visuals */}
        <div className="w-full md:w-5/12 bg-blue-600 p-12 text-white flex flex-col justify-between relative overflow-hidden hidden md:flex">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-700 to-indigo-900 opacity-90 z-0"></div>

          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-4 mb-12">
              <h1 className="text-3xl font-bold tracking-tight">Minan Ventures</h1>
            </div>

            <div className="flex-grow flex flex-col justify-center">
              <h2 className="text-4xl font-extrabold mb-6 leading-tight">
                Manage your <br /> institution <br /> with ease.
              </h2>
              <p className="text-blue-100 text-lg max-w-md">
                The all-in-one education consultancy management system designed to streamline admissions and boost productivity.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-12 bg-white/10 p-6 rounded-2xl backdrop-blur-md border border-white/20 shadow-lg">
            <p className="italic text-blue-50 text-sm">
              "Minan Ventures has transformed how we handle our student management. Highly recommended platform!"
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-400 to-blue-300 rounded-full flex items-center justify-center font-bold text-white shadow-sm border border-white/10">
                NK
              </div>
              <div>
                <p className="font-semibold text-sm">Nithish Kumar</p>
                <p className="text-blue-200 text-xs text-opacity-90">Founder, Minan Ventures</p>
              </div>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-50 z-0 animate-pulse"></div>
          <div className="absolute top-1/4 -right-24 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-50 z-0"></div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full md:w-7/12 p-8 md:p-16 bg-white flex flex-col justify-center relative">
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="flex md:hidden items-center gap-3 mb-8 justify-center">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Minan Ventures</h1>
          </div>

          <div className="max-w-md w-full mx-auto space-y-8">
            <div className="text-center md:text-left">
              <h3 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome back</h3>
              <p className="text-gray-500 mt-2 text-sm">Please enter your details to sign in.</p>
            </div>

            <LoginForm />

            <p className="text-center text-sm text-gray-500 mt-8">
              Developed by{' '}
              <a href="https://blinks-ai.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                Blinks AI
              </a>
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
