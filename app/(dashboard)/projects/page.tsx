import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Plus } from 'lucide-react'
import ProjectsClient from './ProjectsClient'

export const metadata = { title: 'Projects' }

export default async function ProjectsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projects } = await (supabase.from('projects') as any)
    .select('id, title, type, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as
      { data: Array<{ id: string; title: string; type: string; status: string; created_at: string }> | null }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Projects</h1>
          <p className="text-gray-400 text-sm">{projects?.length ?? 0} total projects</p>
        </div>
        <Link
          href="/create-reel"
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Project
        </Link>
      </div>

      <ProjectsClient initialProjects={projects ?? []} />
    </div>
  )
}
