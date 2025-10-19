'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { SystemSettingsService } from '@/lib/systemSettingsService'
import { GroupSettingsService, LevelGroupSettings } from '@/lib/groupSettingsService'

export default function GroupSettingsPage() {
  const { user, userRole, loading: authLoading } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [semester, setSemester] = useState<string>('Fall 2025')
  const [allSettings, setAllSettings] = useState<LevelGroupSettings[]>([])
  const [distributions, setDistributions] = useState<Record<number, any>>({})
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!authLoading && userRole) {
      if (!user || (userRole !== 'scheduling_committee' && userRole !== 'admin')) {
        router.push('/login')
      } else {
        loadData()
      }
    }
  }, [user, userRole, authLoading, router])

  const loadData = async () => {
    setLoading(true)
    try {
      const currentSemester = await SystemSettingsService.getCurrentSemester()
      setSemester(currentSemester)

      await loadAllSettings(currentSemester)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllSettings = async (sem: string) => {
    const settings = await GroupSettingsService.getAllGroupSettings(sem)
    setAllSettings(settings)

    // Load distributions for each level
    const dists: Record<number, any> = {}
    for (const setting of settings) {
      const dist = await GroupSettingsService.getGroupDistribution(setting.level)
      dists[setting.level] = dist
    }
    setDistributions(dists)
  }

  const handleCalculateSettings = async (level: number) => {
    setProcessing(true)
    try {
      await GroupSettingsService.calculateGroupSettings(level, semester)
      await loadAllSettings(semester)
      alert(`✅ Group settings calculated for Level ${level}`)
    } catch (error) {
      console.error('Error calculating settings:', error)
      alert('❌ Failed to calculate settings')
    } finally {
      setProcessing(false)
    }
  }

  const handleUpdateStudentsPerGroup = async (level: number, studentsPerGroup: number) => {
    setProcessing(true)
    try {
      await GroupSettingsService.updateGroupSettings(level, semester, studentsPerGroup)
      await loadAllSettings(semester)
      alert(`✅ Updated group size for Level ${level}`)
    } catch (error) {
      console.error('Error updating settings:', error)
      alert('❌ Failed to update settings')
    } finally {
      setProcessing(false)
    }
  }

  const handleAssignStudents = async (level: number) => {
    if (!confirm(`Assign all Level ${level} students to groups? This will reset existing assignments.`)) {
      return
    }

    setProcessing(true)
    try {
      const result = await GroupSettingsService.assignStudentsToGroups(level, semester)
      if (result.success) {
        await loadAllSettings(semester)
        alert(`✅ Students assigned to groups for Level ${level}`)
      } else {
        alert(`❌ Failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Error assigning students:', error)
      alert('❌ Failed to assign students')
    } finally {
      setProcessing(false)
    }
  }

  const handleCalculateAll = async () => {
    if (!confirm('Calculate group settings for ALL levels (1-8)?')) {
      return
    }

    setProcessing(true)
    try {
      for (let level = 1; level <= 8; level++) {
        await GroupSettingsService.calculateGroupSettings(level, semester)
      }
      await loadAllSettings(semester)
      alert('✅ Group settings calculated for all levels!')
    } catch (error) {
      console.error('Error calculating all settings:', error)
      alert('❌ Failed to calculate all settings')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading group settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Group Settings</h1>
          <p className="text-gray-600">
            Manage student group sizing for <strong>{semester}</strong>
          </p>
        </div>
        <Button onClick={handleCalculateAll} disabled={processing}>
          Calculate All Levels
        </Button>
      </div>

      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>📊 System automatically calculates: <strong>Total Students ÷ Students Per Group = Number of Groups</strong></p>
          <p>✏️ You can adjust "Students Per Group" to change the number of groups</p>
          <p>👥 Click "Assign Students" to automatically distribute students evenly across groups</p>
          <p>⚠️ Irregular students are NOT assigned to groups (they get personalized schedules)</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((level) => {
          const settings = allSettings.find((s) => s.level === level)
          const distribution = distributions[level] || {}

          return (
            <Card key={level}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Level {level}</span>
                  {settings && (
                    <Badge variant="outline">
                      {settings.num_groups} Group{settings.num_groups !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {settings
                    ? `${settings.total_students} students in ${settings.num_groups} groups`
                    : 'No settings configured'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-blue-50 rounded p-2">
                        <div className="text-2xl font-bold text-blue-600">
                          {settings.total_students}
                        </div>
                        <div className="text-xs text-gray-600">Total Students</div>
                      </div>
                      <div className="bg-green-50 rounded p-2">
                        <div className="text-2xl font-bold text-green-600">
                          {settings.students_per_group}
                        </div>
                        <div className="text-xs text-gray-600">Per Group</div>
                      </div>
                      <div className="bg-purple-50 rounded p-2">
                        <div className="text-2xl font-bold text-purple-600">
                          {settings.num_groups}
                        </div>
                        <div className="text-xs text-gray-600">Groups</div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor={`students-per-group-${level}`}>
                        Adjust Students Per Group
                      </Label>
                      <div className="flex space-x-2 mt-2">
                        <Input
                          id={`students-per-group-${level}`}
                          type="number"
                          min="15"
                          max="40"
                          defaultValue={settings.students_per_group}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={(e) => {
                            const input = document.getElementById(
                              `students-per-group-${level}`
                            ) as HTMLInputElement
                            handleUpdateStudentsPerGroup(level, parseInt(input.value))
                          }}
                          disabled={processing}
                        >
                          Update
                        </Button>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-sm font-semibold mb-2">Group Names:</p>
                      <div className="flex flex-wrap gap-1">
                        {settings.group_names.map((name) => (
                          <Badge key={name} variant="secondary">
                            {name} ({distribution[name]?.count || 0})
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => handleAssignStudents(level)}
                      disabled={processing}
                      variant="outline"
                    >
                      Assign Students to Groups
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-500 mb-4">No group settings yet</p>
                    <Button
                      onClick={() => handleCalculateSettings(level)}
                      disabled={processing}
                    >
                      Calculate Settings
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

