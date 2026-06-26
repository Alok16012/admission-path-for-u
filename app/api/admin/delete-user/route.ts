import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    try {
        const supabase = await createServerClient()
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !currentUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single()

        const profile = data as any

        if (!['admin', 'backend'].includes(profile?.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { userId } = await request.json()

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
        }

        // Initialize admin client (bypasses RLS)
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Step 1: Delete profile first (cascades to related tables)
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId)

        if (profileError) {
            throw profileError
        }

        // Step 2: Delete auth user
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (deleteError) {
            throw deleteError
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        const err = error as any
        console.error('Delete user error full:', err)
        return NextResponse.json(
            {
                error: err.message || 'Internal server error',
                details: err.details || err.hint || null,
                code: err.code || null
            },
            { status: 500 }
        )
    }
}
