'use strict'

const { createClient } = require('@supabase/supabase-js')
const ws = require('ws')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    realtime: { transport: ws }
  }
)

async function updateVideoRecord(projectId, data) {
  // video_url/voice_url/duration live on the 'videos' table (keyed by project_id);
  // status lives on the 'projects' table (keyed by id). Route each column to its
  // real table so PostgREST doesn't reject unknown columns.
  const { status, ...videoFields } = data

  if (Object.keys(videoFields).length) {
    const { error } = await supabase
      .from('videos')
      .update(videoFields)
      .eq('project_id', projectId)
    if (error) throw new Error(`Supabase update failed: ${error.message}`)
  }

  if (status !== undefined) {
    const { error } = await supabase
      .from('projects')
      .update({ status })
      .eq('id', projectId)
    if (error) throw new Error(`Supabase update failed: ${error.message}`)
  }

  console.log(`[supabase] video record for project ${projectId} updated`)
}

async function updateProjectStatus(projectId, status) {
  const { error } = await supabase
    .from('projects')
    .update({ status })
    .eq('id', projectId)
  if (error) throw new Error(`Supabase projects update: ${error.message}`)
  console.log(`[supabase] project ${projectId} -> ${status}`)
}

module.exports = { updateVideoRecord, updateProjectStatus }
