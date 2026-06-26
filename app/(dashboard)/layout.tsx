import { createServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/shared/Sidebar'
import { Topbar } from '@/components/shared/Topbar'
import { redirect } from 'next/navigation'
import type { UserRole, Profile } from '@/types/app.types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  let userProfile: Profile = {
    id: '',
    email: user?.email ?? '',
    full_name: 'Admin',
    role: 'admin' as UserRole,
    is_active: true,
    created_at: new Date().toISOString(),
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single() as { data: { id: string; email: string; full_name: string; role: string; phone: string | null; is_active: boolean; created_at: string } | null }

    if (profile) {
      if (!profile.is_active) {
        await supabase.auth.signOut()
        redirect('/login?error=account_inactive')
      }

      userProfile = {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role as UserRole,
        phone: profile.phone ?? undefined,
        is_active: profile.is_active,
        created_at: profile.created_at,
      }
    }
  }

  return (
    <div className="flex h-screen overflow-clip bg-gray-50">
      <Sidebar role={userProfile.role} />
      <div className="flex-1 min-w-0 flex flex-col overflow-clip">
        <Topbar user={userProfile} />
        <main className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 p-4 md:p-6">
            {children}
          </div>
          <footer className="w-full py-4 text-center text-sm text-gray-500 border-t border-gray-200 mt-auto">
            Developed by <a href="https://blinks-ai.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">Blinks AI</a>
          </footer>
        </main>
      </div>
    </div>
  )
}
