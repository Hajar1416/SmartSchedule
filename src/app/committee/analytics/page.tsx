'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/MainLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts'
import { CourseService } from '@/lib/courseService'
import { StudentService } from '@/lib/studentService'
import { RuleService } from '@/lib/ruleService'
import { ScheduleService } from '@/lib/scheduleService'
import { 
  TrendingUp, 
  Users, 
  BookOpen, 
  Calendar,
  Clock,
  Building,
  Settings,
  Download,
  RefreshCw,
  Loader2
} from 'lucide-react'

interface AnalyticsData {
  studentsByLevel: Array<{ level: string; count: number }>
  coursesByLevel: Array<{ level: string; count: number }>
  roomUtilization: Array<{ room: string; utilization: number }>
  scheduleEfficiency: Array<{ semester: string; efficiency: number }>
  sectionDistribution: Array<{ course: string; sections: number }>
  totalStudents: number
  totalCourses: number
  totalSections: number
  averageEfficiency: number
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedLevel, setSelectedLevel] = useState('all')
  const [refreshing, setRefreshing] = useState(false)

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  useEffect(() => {
    loadAnalyticsData()
  }, [])

  const loadAnalyticsData = async () => {
    try {
      setLoading(true)
      
      // Load all data in parallel
      const [courses, students, rules, schedules] = await Promise.all([
        CourseService.getAllCourses(),
        StudentService.getAllStudents(),
        RuleService.getAllRules(),
        ScheduleService.getSchedules()
      ])

      // Process data for analytics
      const studentsByLevel = [
        { level: 'Level 1', count: students.filter(s => s.level === 1).length },
        { level: 'Level 2', count: students.filter(s => s.level === 2).length },
        { level: 'Level 3', count: students.filter(s => s.level === 3).length },
        { level: 'Level 4', count: students.filter(s => s.level === 4).length }
      ]

      const coursesByLevel = [
        { level: 'Level 1', count: courses.filter(c => c.level === 1).length },
        { level: 'Level 2', count: courses.filter(c => c.level === 2).length },
        { level: 'Level 3', count: courses.filter(c => c.level === 3).length },
        { level: 'Level 4', count: courses.filter(c => c.level === 4).length }
      ]

      // Mock room utilization data
      const roomUtilization = [
        { room: 'A101', utilization: 85 },
        { room: 'A102', utilization: 92 },
        { room: 'B205', utilization: 78 },
        { room: 'B206', utilization: 88 },
        { room: 'C301', utilization: 95 },
        { room: 'C302', utilization: 82 },
        { room: 'D101', utilization: 90 },
        { room: 'D102', utilization: 87 }
      ]

      // Mock schedule efficiency data
      const scheduleEfficiency = [
        { semester: 'Fall 2024', efficiency: 92 },
        { semester: 'Spring 2025', efficiency: 88 },
        { semester: 'Summer 2025', efficiency: 95 }
      ]

      // Section distribution
      const sectionDistribution = courses
        .filter(c => c.level === parseInt(selectedLevel) || selectedLevel === 'all')
        .map(course => ({
          course: course.code,
          sections: Math.ceil(Math.random() * 3) + 1 // Mock data
        }))
        .slice(0, 8)

      const totalStudents = students.length
      const totalCourses = courses.length
      const totalSections = courses.reduce((sum, course) => sum + (Math.ceil(Math.random() * 3) + 1), 0)
      const averageEfficiency = schedules.length > 0 
        ? schedules.reduce((sum, s) => sum + s.efficiency, 0) / schedules.length 
        : 0

      setAnalyticsData({
        studentsByLevel,
        coursesByLevel,
        roomUtilization,
        scheduleEfficiency,
        sectionDistribution,
        totalStudents,
        totalCourses,
        totalSections,
        averageEfficiency
      })
    } catch (error) {
      console.error('Error loading analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAnalyticsData()
    setRefreshing(false)
  }

  const handleExport = () => {
    // Mock export functionality
    const dataStr = JSON.stringify(analyticsData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'analytics-data.json'
    link.click()
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 flex items-center justify-center min-h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading analytics data...</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!analyticsData) {
    return (
      <MainLayout>
        <div className="p-6 text-center">
          <p>Failed to load analytics data</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600">Comprehensive insights into scheduling performance</p>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="1">Level 1</SelectItem>
                <SelectItem value="2">Level 2</SelectItem>
                <SelectItem value="3">Level 3</SelectItem>
                <SelectItem value="4">Level 4</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{analyticsData.totalStudents}</p>
                  <p className="text-sm text-gray-600">Total Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <BookOpen className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{analyticsData.totalCourses}</p>
                  <p className="text-sm text-gray-600">Total Courses</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{analyticsData.totalSections}</p>
                  <p className="text-sm text-gray-600">Total Sections</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{Math.round(analyticsData.averageEfficiency)}%</p>
                  <p className="text-sm text-gray-600">Avg Efficiency</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Students by Level */}
          <Card>
            <CardHeader>
              <CardTitle>Students by Academic Level</CardTitle>
              <CardDescription>Distribution of students across different levels</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.studentsByLevel}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Courses by Level */}
          <Card>
            <CardHeader>
              <CardTitle>Courses by Academic Level</CardTitle>
              <CardDescription>Number of courses available per level</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analyticsData.coursesByLevel}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ level, count }) => `${level}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analyticsData.coursesByLevel.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Room Utilization */}
          <Card>
            <CardHeader>
              <CardTitle>Room Utilization</CardTitle>
              <CardDescription>How efficiently rooms are being used</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.roomUtilization}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="room" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => [`${value}%`, 'Utilization']} />
                  <Bar dataKey="utilization" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Schedule Efficiency Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Schedule Efficiency Trends</CardTitle>
              <CardDescription>How schedule efficiency has improved over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analyticsData.scheduleEfficiency}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="semester" />
                  <YAxis domain={[80, 100]} />
                  <Tooltip formatter={(value) => [`${value}%`, 'Efficiency']} />
                  <Line type="monotone" dataKey="efficiency" stroke="#8B5CF6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Section Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Section Distribution by Course</CardTitle>
            <CardDescription>Number of sections per course</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.sectionDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="course" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sections" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Most Utilized Room</p>
                  <p className="text-2xl font-bold">C301</p>
                  <p className="text-sm text-green-600">95% utilization</p>
                </div>
                <Building className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Peak Scheduling Time</p>
                  <p className="text-2xl font-bold">9:00 AM</p>
                  <p className="text-sm text-blue-600">Most popular start time</p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Rules</p>
                  <p className="text-2xl font-bold">12</p>
                  <p className="text-sm text-purple-600">Scheduling constraints</p>
                </div>
                <Settings className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  )
}
