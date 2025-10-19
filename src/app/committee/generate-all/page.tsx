'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Calendar, 
  Clock, 
  Building, 
  Users, 
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Eye,
  RefreshCw,
  BookOpen,
  Zap,
  Brain,
  Plus,
  Trash2,
  Edit3,
  Filter,
  Search,
  Save,
  X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { GenerateAllSchedulesService, GeneratedSchedule } from '@/lib/generateAllSchedulesService'
import { ScheduleService } from '@/lib/scheduleService'
import { generateTimetablePDF } from '@/lib/pdfGenerator'
import { TimetableView, CompactTimetableView } from '@/components/ui/TimetableView'
import { ConflictDetectionService, Conflict } from '@/lib/conflictDetectionService'

interface EditableSection {
  id: string
  course_code: string
  section_label: string
  day: string
  start_time: string
  end_time: string
  room: string
  instructor: string
  student_count: number
  capacity: number
}

interface GroupStats {
  letter: string
  studentCount: number
  hasSchedule: boolean
}

export default function GenerateAllSchedulesPage() {
  const [existingSchedules, setExistingSchedules] = useState<GeneratedSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingLevel, setGeneratingLevel] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Filtering states
  const [selectedLevel, setSelectedLevel] = useState<string>('all')
  const [selectedGroup, setSelectedGroup] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState('')
  
  // AI Editing states
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [currentEditingGroup, setCurrentEditingGroup] = useState('')
  const [currentEditingLevel, setCurrentEditingLevel] = useState(0)

  // Group statistics
  const [groupStats, setGroupStats] = useState<Record<number, GroupStats[]>>({})
  const [loadingGroupStats, setLoadingGroupStats] = useState(false)

  // Conflict detection
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loadingConflicts, setLoadingConflicts] = useState(false)
  const [showConflicts, setShowConflicts] = useState(false)
  const [resolvePrompt, setResolvePrompt] = useState('')
  const [resolvingConflicts, setResolvingConflicts] = useState(false)

  const levelsAvailable = [1, 2, 3, 4, 5, 6, 7, 8]

  // Helper functions for per-schedule group selection
  const getSelectedGroupForSchedule = (scheduleId: string) => {
    return selectedGroup[scheduleId] || 'all'
  }

  const setSelectedGroupForSchedule = (scheduleId: string, group: string) => {
    setSelectedGroup(prev => ({
      ...prev,
      [scheduleId]: group
    }))
  }

  useEffect(() => {
    loadExistingSchedules()
    loadGroupStatistics()
    loadConflicts()
  }, [])

  useEffect(() => {
    // Reload conflicts when schedules change
    if (existingSchedules.length > 0) {
      loadConflicts()
    }
  }, [existingSchedules])

  const loadGroupStatistics = async () => {
    try {
      setLoadingGroupStats(true)
      const stats: Record<number, GroupStats[]> = {}
      
      for (const level of levelsAvailable) {
        const levelStats = await GenerateAllSchedulesService.getGroupStatistics(level)
        stats[level] = levelStats.groups
      }
      
      setGroupStats(stats)
      console.log('✅ Loaded group statistics:', stats)
    } catch (error: any) {
      console.error('Failed to load group statistics:', error)
    } finally {
      setLoadingGroupStats(false)
    }
  }

  const loadConflicts = async () => {
    try {
      setLoadingConflicts(true)
      const detected = await ConflictDetectionService.detectAllConflicts()
      setConflicts(detected)
      console.log(`🔍 Detected ${detected.length} conflicts`)
      
      // Auto-show conflicts if any detected
      if (detected.length > 0) {
        setShowConflicts(true)
      }
    } catch (error: any) {
      console.error('Failed to load conflicts:', error)
    } finally {
      setLoadingConflicts(false)
    }
  }

  const loadExistingSchedules = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch latest schedules (new schema uses top-level `groups`)
      const { data, error } = await supabase
        .from('schedule_versions')
        .select('id, level, semester, groups, total_sections, conflicts, efficiency, generated_at, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to load schedules: ${error.message}`)
      }

      // Convert raw data to GeneratedSchedule format and filter to only latest per level
      const allSchedules: GeneratedSchedule[] = (data || []).map(row => {
        const groups = (row as any).groups || {}
        const totalSections = (row as any).total_sections || Object.values(groups).reduce((acc: number, group: any) => acc + (group.sections?.length || 0), 0)
        const conflicts = (row as any).conflicts || 0
        const efficiency = (row as any).efficiency || 0

        return {
          id: row.id || `db-${row.created_at || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          level: row.level || 1,
          groups,
          total_sections: totalSections,
          conflicts,
          efficiency,
          generated_at: (row as any).generated_at || row.created_at || new Date().toISOString()
        }
      })

      // FILTER: Keep only the LATEST schedule for each level (prevent duplicates)
      const latestSchedulesByLevel = new Map<number, GeneratedSchedule>()
      allSchedules.forEach(schedule => {
        const existing = latestSchedulesByLevel.get(schedule.level)
        if (!existing || new Date(schedule.generated_at) > new Date(existing.generated_at)) {
          latestSchedulesByLevel.set(schedule.level, schedule)
        }
      })
      
      const schedules = Array.from(latestSchedulesByLevel.values()).sort((a, b) => a.level - b.level)

      setExistingSchedules(schedules)
      console.log(`✅ Loaded ${allSchedules.length} total schedules, showing ${schedules.length} latest (one per level)`)
      console.log(`📊 Schedules loaded:`, schedules.map(s => ({
        level: s.level,
        id: s.id,
        groupsCount: Object.keys(s.groups || {}).length,
        totalSections: s.total_sections,
        conflicts: s.conflicts
      })))
      
    } catch (error: any) {
      console.error('Failed to load existing schedules:', error)
      setError(`Failed to load schedules: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const generateAllLevels = async () => {
    try {
      setIsGenerating(true)
      setError(null)
      setSuccess(null)

      const all = await GenerateAllSchedulesService.generateAllLevels()
      // Replace existing with latest per level
      const latestByLevel = new Map<number, GeneratedSchedule>()
      all.forEach(s => {
        const existing = latestByLevel.get(s.level)
        if (!existing || new Date(s.generated_at) > new Date(existing.generated_at)) {
          latestByLevel.set(s.level, s)
        }
      })
      const updated = Array.from(latestByLevel.values()).sort((a,b)=>a.level-b.level)
      setExistingSchedules(updated)
      setSuccess('✅ Generated schedules for all levels with zero conflicts')

      await loadGroupStatistics()
      await loadConflicts()
    } catch (e: any) {
      setError(`❌ Failed to generate all levels: ${e.message}`)
    } finally {
      setIsGenerating(false)
      setGeneratingLevel(null)
    }
  }

  const generateLevelSchedule = async (level: number, specificGroups?: string[]) => {
    try {
      setIsGenerating(true)
      setGeneratingLevel(level)
      setError(null)
      setSuccess(null)

      const newSchedule = await GenerateAllSchedulesService.generateLevelSchedule(level, specificGroups)
      
      // Add to existing schedules or merge with existing
      let updatedSchedule: any = null
      setExistingSchedules(prev => {
        const existingIndex = prev.findIndex(s => s.level === level)
        if (existingIndex >= 0) {
          // Merge groups with existing schedule
          const updated = [...prev]
          updatedSchedule = {
            ...updated[existingIndex],
            groups: {
              ...updated[existingIndex].groups,
              ...newSchedule.groups
            },
            total_sections: updated[existingIndex].total_sections + newSchedule.total_sections,
            generated_at: new Date().toISOString()
          }
          updated[existingIndex] = updatedSchedule
          return updated
        } else {
          // Add new schedule (already saved by generateLevelSchedule)
          return [newSchedule, ...prev]
        }
      })
      
      // Save merged schedule to database
      if (updatedSchedule && updatedSchedule.id) {
        try {
          await GenerateAllSchedulesService.updateSchedule(updatedSchedule.id, {
            groups: updatedSchedule.groups,
            total_sections: updatedSchedule.total_sections,
            conflicts: updatedSchedule.conflicts,
            efficiency: updatedSchedule.efficiency
          })
          console.log(`✅ Saved merged schedule for Level ${level} to database`)
        } catch (dbError: any) {
          console.error(`Failed to save merged schedule:`, dbError)
          setError(`⚠️ Schedule generated but failed to save to database: ${dbError.message}`)
        }
      }
      
      const groupsText = specificGroups ? ` (Groups: ${specificGroups.join(', ')})` : ''
      setSuccess(`✅ Successfully generated schedule for Level ${level}${groupsText}!`)
      
      // Reload group statistics and conflicts
      await loadGroupStatistics()
      await loadConflicts()

    } catch (error: any) {
      setError(`❌ Failed to generate Level ${level}: ${error.message}`)
    } finally {
      setIsGenerating(false)
      setGeneratingLevel(null)
    }
  }

  const generateSpecificGroups = async (level: number, groupLetters: string[]) => {
    await generateLevelSchedule(level, groupLetters)
  }

  const resolveConflictsWithAI = async () => {
    if (!resolvePrompt.trim()) {
      setError('Please enter instructions for conflict resolution')
      return
    }

    try {
      setResolvingConflicts(true)
      setError(null)
      setSuccess(null)

      // Get levels with conflicts
      const levelsWithConflicts = [...new Set(conflicts.map(c => c.affectedLevel))]
      
      console.log(`🤖 AI resolving conflicts for levels: ${levelsWithConflicts.join(', ')}`)
      console.log(`📝 Instructions: ${resolvePrompt}`)

      // Keep track of updates
      const updatedLevels: number[] = []
      
      // Helper to get AI suggestions for a level's conflicts
      const getAISuggestionsForLevel = async (level: number, levelConflicts: Conflict[], existingSchedule: GeneratedSchedule | undefined): Promise<string> => {
        try {
          if (!existingSchedule) return ''
          const resp = await fetch('/api/resolve-conflicts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conflicts: levelConflicts,
              currentSchedule: existingSchedule
            })
          })
          if (!resp.ok) return ''
          const data = await resp.json()
          return data.resolution || ''
        } catch (e) {
          console.warn('AI suggestion fetch failed:', e)
          return ''
        }
      }

      // Regenerate schedules with conflict resolution prompt
      for (const level of levelsWithConflicts) {
        console.log(`\n🔧 Processing Level ${level} for conflict resolution...`)
        
        const levelConflicts = conflicts.filter(c => c.affectedLevel === level)
        const conflictDescriptions = levelConflicts.map(c => c.description).join('\n')
        
        // Get existing schedule data
        const existingSchedule = existingSchedules.find(s => s.level === level)
        // Fetch AI suggestions specific to this level's conflicts
        const aiSuggestions = await getAISuggestionsForLevel(level, levelConflicts, existingSchedule)
        const enhancedPrompt = `${resolvePrompt}\n\nCurrent conflicts to resolve:\n${conflictDescriptions}\n\nAI recommendations:\n${aiSuggestions}\n\nIMPORTANT: Avoid these specific conflicts when generating the schedule.`

        if (!existingSchedule) {
          console.warn(`⚠️ No existing schedule found in state for Level ${level}`)
          continue
        }

        const enhancedConstraints = await buildEnhancedConstraints(level)
        
        // Regenerate with AI
        console.log(`🤖 Calling AI to regenerate Level ${level}...`)
        const newSchedule = await GenerateAllSchedulesService.generateLevelScheduleWithPrompt(
          level,
          enhancedPrompt,
          enhancedConstraints
        )
        
        console.log(`📦 AI returned schedule for Level ${level}:`, {
          groupsCount: Object.keys(newSchedule.groups || {}).length,
          totalSections: newSchedule.total_sections,
          conflicts: newSchedule.conflicts
        })

        // Find and update the existing schedule in database for this level
        const { data: existingDbSchedules, error: findError } = await supabase
          .from('schedule_versions')
          .select('id')
          .eq('level', level)
          .order('created_at', { ascending: false })
          .limit(1)
        
        if (findError) {
          console.error(`❌ Error finding schedule for Level ${level}:`, findError)
          throw new Error(`Failed to find Level ${level} schedule: ${findError.message}`)
        }
        
        if (existingDbSchedules && existingDbSchedules.length > 0) {
          // UPDATE existing schedule
          const dbScheduleId = existingDbSchedules[0].id
          console.log(`💾 Updating schedule in DB for Level ${level} (ID: ${dbScheduleId})...`)
          
          await GenerateAllSchedulesService.updateSchedule(dbScheduleId, {
            groups: newSchedule.groups,
            total_sections: newSchedule.total_sections,
            conflicts: newSchedule.conflicts,
            efficiency: newSchedule.efficiency
          })
          
          console.log(`✅ Successfully updated Level ${level} in database`)
          updatedLevels.push(level)
        } else {
          console.error(`❌ No existing schedule found in DB for Level ${level}`)
          throw new Error(`Cannot update Level ${level} - no existing schedule found`)
        }
      }

      console.log(`\n✅ Updated ${updatedLevels.length} levels: ${updatedLevels.join(', ')}`)
      
      setSuccess(`✅ AI successfully resolved conflicts for ${updatedLevels.length} level(s)!`)
      setResolvePrompt('')
      
      // Reload schedules from database to show updated data
      console.log('🔄 Reloading all schedules from database...')
      await loadExistingSchedules()
      
      // Reload conflicts to verify resolution
      console.log('🔄 Rechecking for conflicts...')
      await loadConflicts()
      
      console.log('✅ Conflict resolution complete!')

    } catch (error: any) {
      setError(`❌ Failed to resolve conflicts: ${error.message}`)
    } finally {
      setResolvingConflicts(false)
    }
  }

  const deleteSchedule = async (scheduleId: string, level: number) => {
    if (!confirm(`Are you sure you want to delete the Level ${level} schedule?`)) {
      return
    }

    try {
      await GenerateAllSchedulesService.deleteSchedule(scheduleId)
      setExistingSchedules(prev => prev.filter(s => s.id !== scheduleId))
      setSuccess(`✅ Deleted Level ${level} schedule`)
    } catch (error: any) {
      setError(`❌ Failed to delete schedule: ${error.message}`)
    }
  }

  const downloadSchedule = (schedule: GeneratedSchedule) => {
    // Convert schedule to timetable entries for PDF
    const timetableEntries = Object.entries(schedule.groups).flatMap(([groupName, groupData]) =>
      groupData.sections.map((section: any) => ({
        course_code: `${section.course_code} (${groupName})`,
        course_title: section.course_title || section.course_code,
        section_label: section.section_label || 'A',
        timeslot: {
          day: section.day,
          start: section.start_time,
          end: section.end_time
        },
        room: section.room,
        instructor: section.instructor || 'TBA'
      }))
    )

    const studentInfo = {
      name: `Level ${schedule.level} - All Groups`,
      level: schedule.level
    }

    generateTimetablePDF(timetableEntries, studentInfo)
  }

  // AI Editing Functions
  const startEditing = (schedule: GeneratedSchedule, groupName: string) => {
    setEditingSchedule(`${schedule.id}-${groupName}`)
    setCurrentEditingGroup(groupName)
    setCurrentEditingLevel(schedule.level)
    setEditPrompt('')
  }

  const cancelEditing = () => {
    setEditingSchedule(null)
    setEditPrompt('')
    setCurrentEditingGroup('')
    setCurrentEditingLevel(0)
  }

  const saveEdits = async () => {
    if (!editPrompt.trim()) return

    try {
      setIsRegenerating(true)
      setError(null)
      setSuccess(null)

      // Build enhanced constraints for conflict prevention
      const enhancedConstraints = await buildEnhancedConstraints(currentEditingLevel)

      // Call AI to regenerate the schedule
      const newSchedule = await GenerateAllSchedulesService.generateLevelScheduleWithPrompt(
        currentEditingLevel,
        editPrompt,
        enhancedConstraints
      )
      
      console.log('📦 AI returned new schedule:', {
        level: newSchedule.level,
        groupsCount: Object.keys(newSchedule.groups || {}).length,
        groupNames: Object.keys(newSchedule.groups || {}),
        totalSections: newSchedule.total_sections
      })
      
      // Update the ENTIRE schedule (replace ALL groups with AI-generated groups)
      let scheduleToUpdate: any = null
      const updatedSchedules = existingSchedules.map(schedule => {
        if (schedule.level === currentEditingLevel) {
          const updatedSchedule = {
            ...schedule,
            groups: newSchedule.groups,  // ✅ REPLACE ALL GROUPS (not just one group)
            total_sections: newSchedule.total_sections || Object.values(newSchedule.groups).reduce((sum: number, g: any) => sum + (g.sections?.length || 0), 0),
            efficiency: newSchedule.efficiency,
            conflicts: newSchedule.conflicts,
            generated_at: new Date().toISOString()
          }
          
          console.log('📝 Updated schedule for Level', currentEditingLevel, ':', {
            id: schedule.id,
            groupsCount: Object.keys(updatedSchedule.groups).length,
            totalSections: updatedSchedule.total_sections
          })
          
          scheduleToUpdate = schedule.id ? { id: schedule.id, data: updatedSchedule } : null
          
          return updatedSchedule
        }
        return schedule
      })
      
      console.log('📊 All schedules after update:', updatedSchedules.map(s => ({ level: s.level, id: s.id, groupsCount: Object.keys(s.groups || {}).length })))
      
      // Update in database - find the existing schedule for this level and update it
      if (scheduleToUpdate) {
        try {
          // Find the existing schedule in database for this level
          const { data: existingDbSchedules, error: findError } = await supabase
            .from('schedule_versions')
            .select('id')
            .eq('level', currentEditingLevel)
            .order('created_at', { ascending: false })
            .limit(1)
          
          if (findError) throw findError
          
          if (existingDbSchedules && existingDbSchedules.length > 0) {
            // UPDATE existing schedule
            const dbScheduleId = existingDbSchedules[0].id
            console.log(`✅ Found existing schedule in DB for Level ${currentEditingLevel}: ${dbScheduleId}`)
            
            await GenerateAllSchedulesService.updateSchedule(dbScheduleId, {
              groups: scheduleToUpdate.data.groups,
              total_sections: scheduleToUpdate.data.total_sections,
              conflicts: scheduleToUpdate.data.conflicts,
              efficiency: scheduleToUpdate.data.efficiency
            })
            console.log('✅ Updated existing schedule in database')
          } else {
            // No existing schedule found, this shouldn't happen but handle it
            console.warn(`⚠️ No existing schedule found in DB for Level ${currentEditingLevel}. This should not happen.`)
          }
        } catch (dbError: any) {
          console.error('Failed to update schedule in DB:', dbError)
          setError(`⚠️ Changes applied but failed to save to database: ${dbError.message}`)
        }
      }
      
      setExistingSchedules(updatedSchedules)
      
      // Check if there are still conflicts in the new schedule
      const updatedSchedule = updatedSchedules.find(s => s.level === currentEditingLevel)
      if (updatedSchedule && updatedSchedule.conflicts > 0) {
        setSuccess(`⚠️ Schedule updated but still has ${updatedSchedule.conflicts} conflicts. Try editing again with clearer instructions.`)
      } else {
        setSuccess(`✅ AI successfully updated Level ${currentEditingLevel} with NO conflicts!`)
      }
      
      // Reload from database to ensure UI is in sync
      console.log('🔄 Reloading schedules from database...')
      await loadExistingSchedules()
      
      // Reload conflicts after update
      await loadConflicts()

    } catch (error: any) {
      setError(`❌ AI regeneration failed: ${error.message}`)
      console.error('Edit error:', error)
    } finally {
      setIsRegenerating(false)
      cancelEditing()
    }
  }

  const buildEnhancedConstraints = async (currentLevel: number) => {
    // STRICT: Get existing schedules for ALL other levels directly from database to avoid conflicts
    const { data: otherLevelSchedulesData, error: schedulesError } = await supabase
      .from('schedule_versions')
      .select('level, diff_json')
      .neq('level', currentLevel)
      .order('created_at', { ascending: false })
    
    if (schedulesError) {
      console.error('Error loading other level schedules:', schedulesError)
    }

    // Get the latest schedule for each level
    const latestSchedulesByLevel = new Map<number, any>()
    if (otherLevelSchedulesData) {
      for (const schedule of otherLevelSchedulesData) {
        if (!latestSchedulesByLevel.has(schedule.level)) {
          latestSchedulesByLevel.set(schedule.level, schedule)
        }
      }
    }

    // Extract ALL occupied slots from ALL other levels
    const occupiedSlots: any[] = []
    for (const [levelNum, schedule] of latestSchedulesByLevel.entries()) {
      const groups = schedule.diff_json?.groups || {}
      
      for (const [groupName, groupData] of Object.entries(groups)) {
        const sections = (groupData as any).sections || []
        
        for (const section of sections) {
          occupiedSlots.push({
            day: section.day,
            start_time: section.start_time,
            end_time: section.end_time,
            room: section.room,
            level: levelNum,
            course: section.course_code
          })
        }
      }
    }

    console.log(`🔒 STRICT MODE: Found ${occupiedSlots.length} occupied slots from ${latestSchedulesByLevel.size} other levels`)

    // Get available rooms from database
    const { data: roomsData } = await supabase.from('rooms').select('name')
    const availableRooms = roomsData?.map(r => r.name) || ['A101', 'A102', 'D101', 'D102', 'E201', 'E202', 'LAB1', 'LAB2']

    return {
      level: currentLevel,
      userPrompt: editPrompt,
      occupiedSlots,
      availableRooms,
      studentCount: 80,
      conflictPreventionRules: [
        'CRITICAL: Avoid time conflicts with other levels in the same rooms',
        'CRITICAL: Maintain afternoon-only policy (12 PM onwards)',
        'CRITICAL: No classes on Friday',
        'Optimize for minimal disruption to other levels',
        'Balance instructor workload',
        'Ensure proper room utilization'
      ],
      editingMode: true,
      preserveConsistency: true
    }
  }

  // Filter schedules
  const filteredSchedules = existingSchedules.filter(schedule => {
    const matchesLevel = selectedLevel === 'all' || schedule.level.toString() === selectedLevel
    const matchesSearch = searchTerm === '' || 
      schedule.level.toString().includes(searchTerm)
    
    return matchesLevel && matchesSearch
  })

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null)
        setError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [success, error])

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Generate All Schedules</h1>
            <p className="text-gray-600">AI-powered schedule generation for all academic levels</p>
          </div>
          <div className="flex gap-2">
            {conflicts.length > 0 && (
              <Button 
                onClick={() => setShowConflicts(!showConflicts)} 
                variant="outline" 
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                <AlertCircle className="h-4 w-4 mr-1" />
                {conflicts.length} Conflicts
              </Button>
            )}
            <Button onClick={loadExistingSchedules} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button onClick={generateAllLevels} size="sm" disabled={isGenerating} className="bg-blue-600 hover:bg-blue-700">
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Generating All...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-1" />
                  Generate All
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Conflict Detection Panel */}
        {showConflicts && conflicts.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-red-900">
                  <AlertCircle className="h-5 w-5" />
                  {conflicts.length} Schedule Conflicts Detected
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowConflicts(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription className="text-red-700">
                Use AI to automatically resolve these conflicts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Conflict List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {conflicts.map((conflict, index) => (
                  <Alert key={conflict.id} variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex items-start justify-between">
                        <div>
                          <strong className="text-sm">#{index + 1}: {conflict.description}</strong>
                          <p className="text-xs mt-1">
                            Affected: {conflict.affectedCourses.join(', ')}
                          </p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {conflict.type} conflict - {conflict.severity} severity
                          </Badge>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>

              {/* AI Resolution */}
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="h-4 w-4 text-blue-600" />
                    AI Conflict Resolution
                  </CardTitle>
                  <CardDescription className="text-blue-700">
                    Describe how you want the AI to resolve these conflicts
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={resolvePrompt}
                    onChange={(e) => setResolvePrompt(e.target.value)}
                    placeholder="Example: Reschedule conflicting courses to different time slots, prioritize afternoon times, use available rooms efficiently..."
                    rows={4}
                    className="bg-white"
                    disabled={resolvingConflicts}
                  />
                  
                  <div className="flex flex-wrap gap-2">
                    <p className="text-xs text-blue-600 w-full">Quick suggestions:</p>
                    {[
                      "Reschedule to avoid room conflicts",
                      "Move to different time slots",
                      "Use alternative rooms",
                      "Optimize for minimal disruption"
                    ].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setResolvePrompt(prev => prev ? `${prev}\n- ${suggestion}` : `- ${suggestion}`)}
                        disabled={resolvingConflicts}
                      >
                        + {suggestion}
                      </Button>
                    ))}
                  </div>

                  <Button
                    onClick={resolveConflictsWithAI}
                    disabled={resolvingConflicts || !resolvePrompt.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {resolvingConflicts ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        AI Resolving Conflicts...
                      </>
                    ) : (
                      <>
                        <Brain className="mr-2 h-4 w-4" />
                        Resolve Conflicts with AI
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        )}

        {/* Status Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="level-filter">Level</Label>
                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {levelsAvailable.map(level => (
                      <SelectItem key={level} value={level.toString()}>Level {level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              


              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search schedules..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
            </div>
            </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>Loading schedules...</span>
            </CardContent>
          </Card>
        ) : existingSchedules.length === 0 ? (
          /* No Schedules - Show Generation Options */
        <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Brain className="h-6 w-6 text-blue-600" />
                No Schedules Found
            </CardTitle>
            <CardDescription>
                Generate AI-powered schedules for your academic levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {levelsAvailable.map((level) => {
                const stats = groupStats[level] || []
                const groupsWithStudents = stats.filter(g => g.studentCount > 0)
                const totalStudents = stats.reduce((sum, g) => sum + g.studentCount, 0)
                const hasAnyStudents = totalStudents > 0

                return (
                  <Card key={level} className="border-2 border-dashed border-gray-200 hover:border-blue-300 transition-colors">
                    <CardContent className="p-6">
                      <div className="mb-4 text-center">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                          <BookOpen className="h-6 w-6 text-blue-600" />
                        </div>
                        <h3 className="font-semibold text-lg">Level {level}</h3>
                        <p className="text-sm text-gray-600">{totalStudents} students total</p>
                      </div>

                      {/* Group Statistics */}
                      <div className="mb-4 space-y-2">
                        <p className="text-xs font-medium text-gray-600 text-center">Groups with Students:</p>
                        <div className="flex justify-center gap-2">
                          {['A', 'B', 'C'].map(letter => {
                            const stat = stats.find(s => s.letter === letter)
                            const count = stat?.studentCount || 0
                            return (
                              <Badge 
                                key={letter}
                                variant={count > 0 ? "default" : "outline"}
                                className={count > 0 ? "bg-green-100 text-green-800" : ""}
                              >
                                {letter}: {count}
                              </Badge>
                            )
                          })}
                        </div>
                      </div>

                      <Button
                        onClick={() => generateLevelSchedule(level)}
                        disabled={isGenerating || !hasAnyStudents}
                        className="w-full"
                        title={!hasAnyStudents ? "No students in this level" : ""}
                      >
                        {generatingLevel === level ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Brain className="h-4 w-4 mr-2" />
                            Generate {groupsWithStudents.length > 0 ? `Groups ${groupsWithStudents.map(g => g.letter).join(', ')}` : 'Schedule'}
                          </>
                        )}
                      </Button>

                      {!hasAnyStudents && (
                        <p className="text-xs text-red-600 text-center mt-2">
                          No students assigned to this level
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
        ) : (
          /* Existing Schedules Display - Combined Groups */
          <div className="space-y-6">
            {filteredSchedules.map((schedule, index) => (
              <Card key={`schedule-${schedule.id || `temp-${schedule.level}-${index}`}`} className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                  <div>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        Level {schedule.level} Schedule
                    </CardTitle>
                      <CardDescription>
                        {Object.keys(schedule.groups).length} groups • {schedule.total_sections} total sections
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {schedule.efficiency}% Efficiency
                      </Badge>
                      <Badge variant={schedule.conflicts === 0 ? "default" : "destructive"}>
                        {schedule.conflicts} Conflicts
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadSchedule(schedule)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteSchedule(schedule.id || '', schedule.level)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Combined Groups View */}
                  <div className="space-y-6">
                    {/* Group Tabs/Filters */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        {Object.keys(schedule.groups).map(groupName => {
                          const currentSelectedGroup = getSelectedGroupForSchedule(schedule.id || '')
                          return (
                            <Button
                              key={groupName}
                              variant={currentSelectedGroup === 'all' || currentSelectedGroup === groupName ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedGroupForSchedule(schedule.id || '', currentSelectedGroup === groupName ? 'all' : groupName)}
                            >
                              {groupName}
                              <Badge variant="secondary" className="ml-2">
                                {schedule.groups[groupName].student_count}
                              </Badge>
                            </Button>
                          )
                        })}
                        {getSelectedGroupForSchedule(schedule.id || '') !== 'all' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedGroupForSchedule(schedule.id || '', 'all')}
                          >
                            Show All Groups
                          </Button>
                        )}
                      </div>
                      
                      {/* Edit buttons for each group */}
                      <div className="flex gap-2">
                        {Object.entries(schedule.groups)
                          .filter(([groupName]) => {
                            const currentSelectedGroup = getSelectedGroupForSchedule(schedule.id || '')
                            return currentSelectedGroup === 'all' || groupName === currentSelectedGroup
                          })
                          .map(([groupName]) => (
                            <Button
                              key={`edit-${groupName}`}
                              variant="outline"
                              size="sm"
                              onClick={() => startEditing(schedule, groupName)}
                              disabled={editingSchedule === `${schedule.id}-${groupName}`}
                            >
                              <Edit3 className="h-4 w-4 mr-1" />
                              Edit {groupName}
                            </Button>
                          ))}
                      </div>
                    </div>

                    {/* Combined Timetable View */}
                    {getSelectedGroupForSchedule(schedule.id || '') === 'all' ? (
                      /* Show all groups in one combined timetable */
                      <TimetableView
                        schedule={Object.entries(schedule.groups).flatMap(([groupName, groupData]) =>
                          groupData.sections.map((section: any) => ({
                            course_code: `${section.course_code} (${groupName})`,
                            section_label: section.section_label,
                            timeslot: {
                              day: section.day,
                              start: section.start_time,
                              end: section.end_time
                            },
                            room: section.room,
                            instructor_id: section.instructor || 'TBA',
                            student_count: section.student_count,
                            capacity: section.capacity
                          }))
                        )}
                        title={`Level ${schedule.level} - All Groups Combined`}
                        studentInfo={{
                          name: `All Groups (${Object.keys(schedule.groups).join(', ')})`,
                          level: schedule.level
                        }}
                      />
                    ) : (
                      /* Show individual group */
                      Object.entries(schedule.groups)
                        .filter(([groupName]) => groupName === getSelectedGroupForSchedule(schedule.id || ''))
                        .map(([groupName, groupData]) => (
                          <div key={`group-${groupName}`}>
                            {editingSchedule === `${schedule.id}-${groupName}` ? (
                              /* AI-Powered Editing Mode */
                              <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                      <Brain className="h-5 w-5 text-purple-600" />
                                      AI Schedule Editor - {groupName}
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                      Describe your changes and AI will regenerate the schedule intelligently
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button 
                                      onClick={saveEdits} 
                                      size="sm"
                                      disabled={isRegenerating || !editPrompt.trim()}
                                      className="bg-purple-600 hover:bg-purple-700"
                                    >
                                      {isRegenerating ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                          AI Regenerating...
                                        </>
                                      ) : (
                                        <>
                                          <Brain className="h-4 w-4 mr-1" />
                                          Regenerate with AI
                                        </>
                                      )}
                                    </Button>
                                    <Button onClick={cancelEditing} variant="outline" size="sm">
                                      <X className="h-4 w-4 mr-1" />
                                      Cancel
                                    </Button>
                                  </div>
                                </div>

                                {/* AI Prompt Interface */}
                                <Card className="border-purple-200 bg-purple-50">
                                  <CardHeader>
                                    <CardTitle className="text-sm flex items-center gap-2">
                                      <Brain className="h-4 w-4 text-purple-600" />
                                      AI Editing Instructions
                                    </CardTitle>
                                    <CardDescription>
                                      Tell the AI what changes you want. It will regenerate the schedule while avoiding conflicts with other levels.
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-4">
                                      <div>
                                        <Label htmlFor="edit-prompt">Editing Instructions</Label>
                                        <Textarea
                                          id="edit-prompt"
                                          value={editPrompt}
                                          onChange={(e) => setEditPrompt(e.target.value)}
                                          placeholder="Example: Move CS301 to Wednesday afternoon, avoid conflicts with Level 2, optimize room usage..."
                                          rows={6}
                                          className="bg-white"
                                        />
                                      </div>
                                      
                                      {/* Quick Prompt Suggestions */}
                                      <div>
                                        <Label className="text-xs text-gray-600">Quick Suggestions:</Label>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                          {[
                                            "Optimize for afternoon slots only",
                                            "Minimize room conflicts",
                                            "Balance instructor workload", 
                                            "Avoid overlaps with other levels",
                                            "Improve student flow between classes"
                                          ].map((suggestion) => (
                                            <Button
                                              key={suggestion}
                                              variant="outline"
                                              size="sm"
                                              className="text-xs"
                                              onClick={() => setEditPrompt(prev => prev + (prev ? '\n- ' : '- ') + suggestion)}
                                            >
                                              + {suggestion}
                                            </Button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Current Schedule Preview */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-sm">Current Schedule (Will be regenerated)</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <TimetableView
                                      schedule={groupData.sections.map((section: any) => ({
                                        course_code: section.course_code,
                                        section_label: section.section_label,
                                        timeslot: {
                                          day: section.day,
                                          start: section.start_time,
                                          end: section.end_time
                                        },
                                        room: section.room,
                                        instructor_id: section.instructor || 'TBA',
                                        student_count: section.student_count,
                                        capacity: section.capacity
                                      }))}
                                      title={`Current ${groupName} Schedule`}
                                      studentInfo={{
                                        name: `Level ${schedule.level} - ${groupName}`,
                                        level: schedule.level
                                      }}
                                    />
                                  </CardContent>
                                </Card>

                                {/* Conflict Prevention Info */}
                                <Alert>
                                  <CheckCircle className="h-4 w-4" />
                                  <AlertDescription>
                                    <strong>AI Conflict Prevention:</strong> The system will automatically avoid conflicts with other levels, 
                                    respect the afternoon-only policy, and maintain consistency across all schedules.
                                  </AlertDescription>
                                </Alert>
                              </div>
                            ) : (
                              /* Display Mode - Individual Group */
                              <TimetableView
                                schedule={groupData.sections.map((section: any) => ({
                                  course_code: section.course_code,
                                  section_label: section.section_label,
                                  timeslot: {
                                    day: section.day,
                                    start: section.start_time,
                                    end: section.end_time
                                  },
                                  room: section.room,
                                  instructor_id: section.instructor || 'TBA',
                                  student_count: section.student_count,
                                  capacity: section.capacity
                                }))}
                                title={`${groupName} Timetable`}
                                studentInfo={{
                                  name: `Level ${schedule.level} - ${groupName}`,
                                  level: schedule.level
                                }}
                              />
                            )}
                          </div>
                        ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Generate More Button */}
            <Card className="border-2 border-dashed border-gray-200">
              <CardContent className="p-6">
                <div className="mb-4 text-center">
                  <Plus className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <h3 className="text-lg font-semibold text-gray-700">Generate More Schedules</h3>
                  <p className="text-sm text-gray-600">Create schedules for levels or groups</p>
                </div>
                
                {/* Levels without any schedules */}
                <div className="space-y-4">
                  {levelsAvailable.map((level) => {
                    const existingSchedule = existingSchedules.find(s => s.level === level)
                    const stats = groupStats[level] || []
                    const groupsWithStudents = stats.filter(g => g.studentCount > 0)
                    const totalStudents = stats.reduce((sum, g) => sum + g.studentCount, 0)
                    
                    // Find groups that have students but no schedule
                    const groupsNeedingSchedule = stats.filter(g => 
                      g.studentCount > 0 && 
                      (!existingSchedule || !existingSchedule.groups[`Group ${g.letter}`])
                    )

                    const hasNoSchedule = !existingSchedule
                    const hasPartialSchedule = existingSchedule && groupsNeedingSchedule.length > 0

                    if (!hasNoSchedule && !hasPartialSchedule) return null

                    return (
                      <Card key={level} className="border border-gray-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-semibold">Level {level}</h4>
                              <p className="text-xs text-gray-600">{totalStudents} students</p>
                            </div>
                            <div className="flex gap-1">
                              {['A', 'B', 'C'].map(letter => {
                                const stat = stats.find(s => s.letter === letter)
                                const count = stat?.studentCount || 0
                                const hasSchedule = existingSchedule?.groups[`Group ${letter}`]
                                return (
                                  <Badge 
                                    key={letter}
                                    variant={count > 0 ? (hasSchedule ? "default" : "outline") : "secondary"}
                                    className={
                                      count > 0 
                                        ? hasSchedule 
                                          ? "bg-blue-100 text-blue-800" 
                                          : "bg-orange-100 text-orange-800 border-orange-300"
                                        : ""
                                    }
                                    title={
                                      count > 0 
                                        ? hasSchedule 
                                          ? `${letter}: ${count} (has schedule)` 
                                          : `${letter}: ${count} (needs schedule)`
                                        : `${letter}: ${count} (no students)`
                                    }
                                  >
                                    {letter}
                                  </Badge>
                                )
                              })}
                            </div>
                          </div>

                          {hasNoSchedule && totalStudents > 0 && (
                            <Button
                              onClick={() => generateLevelSchedule(level)}
                              disabled={isGenerating}
                              variant="outline"
                              size="sm"
                              className="w-full"
                            >
                              {generatingLevel === level ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <Brain className="h-4 w-4 mr-1" />
                                  Generate Level {level} (Groups: {groupsWithStudents.map(g => g.letter).join(', ')})
                                </>
                              )}
                            </Button>
                          )}

                          {hasPartialSchedule && (
                            <div className="space-y-2">
                              <p className="text-xs text-orange-600 font-medium">
                                Missing schedules for: {groupsNeedingSchedule.map(g => `Group ${g.letter} (${g.studentCount} students)`).join(', ')}
                              </p>
                              <Button
                                onClick={() => generateSpecificGroups(level, groupsNeedingSchedule.map(g => g.letter))}
                                disabled={isGenerating}
                                variant="outline"
                                size="sm"
                                className="w-full border-orange-300 hover:bg-orange-50"
                              >
                                {generatingLevel === level ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Generate for Groups {groupsNeedingSchedule.map(g => g.letter).join(', ')}
                                  </>
                                )}
                              </Button>
                            </div>
                          )}

                          {totalStudents === 0 && (
                            <p className="text-xs text-gray-500 text-center">
                              No students assigned to this level yet
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {levelsAvailable.every(level => {
                  const existingSchedule = existingSchedules.find(s => s.level === level)
                  const stats = groupStats[level] || []
                  const groupsNeedingSchedule = stats.filter(g => 
                    g.studentCount > 0 && 
                    (!existingSchedule || !existingSchedule.groups[`Group ${g.letter}`])
                  )
                  return groupsNeedingSchedule.length === 0
                }) && (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p className="font-medium">All groups with students have schedules!</p>
                    <p className="text-sm">Add more students to generate additional schedules</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
  )
}