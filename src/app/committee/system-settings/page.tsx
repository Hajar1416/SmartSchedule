'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SystemSettingsService } from '@/lib/systemSettingsService'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

export default function SystemSettingsPage() {
  const { user, userRole, loading: authLoading } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    current_semester: 'Fall 2025',
    preference_collection_open: false,
    preference_deadline: '2025-10-15',
    default_students_per_group: 25
  })

  useEffect(() => {
    if (!authLoading && userRole) {
      if (!user || (userRole !== 'scheduling_committee' && userRole !== 'admin')) {
        router.push('/login')
      } else {
        loadSettings()
      }
    }
  }, [user, userRole, authLoading, router])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const allSettings = await SystemSettingsService.getAllSettings()
      setSettings({
        current_semester: allSettings.current_semester || 'Fall 2025',
        preference_collection_open: allSettings.preference_collection_open || false,
        preference_deadline: allSettings.preference_deadline || '2025-10-15',
        default_students_per_group: allSettings.default_students_per_group || 25
      })
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await SystemSettingsService.updateSetting('current_semester', settings.current_semester)
      await SystemSettingsService.updateSetting(
        'preference_collection_open',
        settings.preference_collection_open
      )
      await SystemSettingsService.updateSetting('preference_deadline', settings.preference_deadline)
      await SystemSettingsService.updateSetting(
        'default_students_per_group',
        settings.default_students_per_group
      )

      alert('✅ Settings saved successfully!')
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('❌ Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">System Settings</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Semester Configuration</CardTitle>
            <CardDescription>Set the current active semester</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="semester">Current Semester</Label>
              <Input
                id="semester"
                value={settings.current_semester}
                onChange={(e) =>
                  setSettings({ ...settings, current_semester: e.target.value })
                }
                placeholder="e.g., Fall 2025, Spring 2026"
                className="mt-2"
              />
              <p className="text-sm text-gray-500 mt-1">
                This semester will be used for all scheduling operations
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Preference Collection</CardTitle>
            <CardDescription>
              Control when students can submit their elective preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="preference-collection">Enable Preference Collection</Label>
                <p className="text-sm text-gray-500">
                  When enabled, students can submit their elective preferences
                </p>
              </div>
              <Switch
                id="preference-collection"
                checked={settings.preference_collection_open}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, preference_collection_open: checked })
                }
              />
            </div>

            <div>
              <Label htmlFor="deadline">Submission Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={settings.preference_deadline}
                onChange={(e) =>
                  setSettings({ ...settings, preference_deadline: e.target.value })
                }
                className="mt-2"
              />
              <p className="text-sm text-gray-500 mt-1">
                Students will be notified of this deadline
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <p className="text-sm text-blue-800">
                <strong>Current Status:</strong>{' '}
                {settings.preference_collection_open ? (
                  <span className="text-green-600 font-semibold">OPEN</span>
                ) : (
                  <span className="text-red-600 font-semibold">CLOSED</span>
                )}
              </p>
              <p className="text-sm text-blue-800 mt-1">
                {settings.preference_collection_open
                  ? '✅ Students can submit preferences now'
                  : '⚠️ Students cannot submit preferences'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Group Sizing</CardTitle>
            <CardDescription>
              Set the default number of students per group
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="students-per-group">Default Students Per Group</Label>
              <Input
                id="students-per-group"
                type="number"
                min="15"
                max="40"
                value={settings.default_students_per_group}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    default_students_per_group: parseInt(e.target.value) || 25
                  })
                }
                className="mt-2"
              />
              <p className="text-sm text-gray-500 mt-1">
                Groups will be created by dividing total students by this number
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button variant="outline" onClick={loadSettings} disabled={saving}>
            Reset
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  )
}

