'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/MainLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScheduleService, ScheduleGenerationRequest, GeneratedSchedule } from '@/lib/scheduleService'
import { 
  Calendar, 
  Users, 
  BookOpen, 
  Clock, 
  Settings, 
  Play, 
  Loader2,
  CheckCircle,
  AlertCircle,
  Brain,
  Target,
  Save,
  Eye
} from 'lucide-react'

export default function GenerateSchedulePage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedSchedule, setGeneratedSchedule] = useState<GeneratedSchedule | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState<ScheduleGenerationRequest>({
    level: 1,
    semester: '',
    maxSections: 5,
    sectionCapacity: 25,
    preferences: '',
    constraints: ''
  })

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError('')
    setSuccess('')

    try {
      const schedule = await ScheduleService.generateSchedule(formData)
      setGeneratedSchedule(schedule)
      setSuccess('Schedule generated successfully!')
    } catch (error: any) {
      setError('Failed to generate schedule: ' + error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApprove = async () => {
    if (!generatedSchedule) return

    try {
      await ScheduleService.approveSchedule(generatedSchedule.id)
      setSuccess('Schedule approved successfully!')
      setGeneratedSchedule({
        ...generatedSchedule,
        status: 'approved'
      })
    } catch (error: any) {
      setError('Failed to approve schedule: ' + error.message)
    }
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Generate Schedule</h1>
            <p className="text-gray-600">Use AI to create optimal academic schedules</p>
          </div>
          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
            <Brain className="w-4 h-4 mr-1" />
            AI-Powered
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5" />
                Schedule Configuration
              </CardTitle>
              <CardDescription>Configure parameters for schedule generation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="level">Academic Level *</Label>
                  <Select value={formData.level.toString()} onValueChange={(value) => setFormData({...formData, level: parseInt(value)})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Level 1</SelectItem>
                      <SelectItem value="2">Level 2</SelectItem>
                      <SelectItem value="3">Level 3</SelectItem>
                      <SelectItem value="4">Level 4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="semester">Semester *</Label>
                  <Select value={formData.semester} onValueChange={(value) => setFormData({...formData, semester: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fall-2024">Fall 2024</SelectItem>
                      <SelectItem value="spring-2025">Spring 2025</SelectItem>
                      <SelectItem value="summer-2025">Summer 2025</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxSections">Max Sections per Course</Label>
                  <Input
                    id="maxSections"
                    type="number"
                    value={formData.maxSections}
                    onChange={(e) => setFormData({...formData, maxSections: parseInt(e.target.value)})}
                    placeholder="5"
                    min="1"
                    max="10"
                  />
                </div>
                <div>
                  <Label htmlFor="sectionCapacity">Section Capacity</Label>
                  <Input
                    id="sectionCapacity"
                    type="number"
                    value={formData.sectionCapacity}
                    onChange={(e) => setFormData({...formData, sectionCapacity: parseInt(e.target.value)})}
                    placeholder="25"
                    min="10"
                    max="50"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="preferences">Student Preferences</Label>
                <Textarea
                  id="preferences"
                  value={formData.preferences}
                  onChange={(e) => setFormData({...formData, preferences: e.target.value})}
                  placeholder="Enter any specific student preferences or requirements..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="constraints">Constraints & Rules</Label>
                <Textarea
                  id="constraints"
                  value={formData.constraints}
                  onChange={(e) => setFormData({...formData, constraints: e.target.value})}
                  placeholder="Enter scheduling constraints, blackout times, room preferences..."
                  rows={3}
                />
              </div>

              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating || !formData.level || !formData.semester}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Schedule...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Generate Schedule
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="mr-2 h-5 w-5" />
                Generation Results
              </CardTitle>
              <CardDescription>AI-generated schedule and metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {generatedSchedule ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{generatedSchedule.sections.length}</div>
                      <div className="text-sm text-gray-600">Sections</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{generatedSchedule.conflicts}</div>
                      <div className="text-sm text-gray-600">Conflicts</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{generatedSchedule.efficiency}%</div>
                      <div className="text-sm text-gray-600">Efficiency</div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-medium">Generated Sections</h4>
                    {generatedSchedule.sections.map((section, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{section.course_code} - {section.section_label}</p>
                          <p className="text-sm text-gray-600">
                            {section.timeslot.day} {section.timeslot.start}-{section.timeslot.end} • {section.room}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{section.student_count}/{section.capacity} students</p>
                          <p className="text-xs text-gray-600">
                            {section.instructor_id ? `Instructor: ${section.instructor_id}` : 'No instructor assigned'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      className="flex-1" 
                      onClick={handleApprove}
                      disabled={generatedSchedule.status === 'approved'}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {generatedSchedule.status === 'approved' ? 'Approved' : 'Approve Schedule'}
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Brain className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Configure parameters and click "Generate Schedule" to create an AI-powered schedule</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Features */}
        <Card>
          <CardHeader>
            <CardTitle>AI-Powered Features</CardTitle>
            <CardDescription>Advanced scheduling capabilities powered by artificial intelligence</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Brain className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium">Smart Conflict Resolution</h4>
                  <p className="text-sm text-gray-600">Automatically detects and resolves scheduling conflicts</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Target className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">Optimized Resource Usage</h4>
                  <p className="text-sm text-gray-600">Maximizes room and instructor utilization</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-medium">Student Preference Matching</h4>
                  <p className="text-sm text-gray-600">Considers student preferences and constraints</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
