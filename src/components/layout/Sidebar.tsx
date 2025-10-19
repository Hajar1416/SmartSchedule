'use client'

import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Calendar,
  Clock,
  Users,
  Settings,
  BookOpen,
  GraduationCap,
  BarChart3,
  FileText,
  MessageSquare,
  LogOut,
  User,
  Home,
  PlusCircle,
  Edit3,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle,
  UserPlus,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const { user, userRole, signOut } = useAuth()
  const pathname = usePathname()

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Settings className="h-4 w-4" />
      case 'student':
        return <GraduationCap className="h-4 w-4" />
      case 'faculty':
        return <BookOpen className="h-4 w-4" />
      case 'scheduling_committee':
        return <Calendar className="h-4 w-4" />
      case 'teaching_load_committee':
        return <Users className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'student':
        return 'bg-blue-100 text-blue-800'
      case 'faculty':
        return 'bg-green-100 text-green-800'
      case 'scheduling_committee':
        return 'bg-purple-100 text-purple-800'
      case 'teaching_load_committee':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getNavigationItems = () => {
    const baseItems = [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
    ]

    // Admin menu items (shared by admin and scheduling_committee)
    const adminMenuItems = [
      ...baseItems,
      { name: 'System Settings', href: '/committee/system-settings', icon: Settings },
      { name: 'Preference Analytics', href: '/committee/preferences-analytics', icon: BarChart3 },
      { name: 'Group Settings', href: '/committee/group-settings', icon: Users },
      { name: 'Generate All Schedules', href: '/committee/generate-all', icon: Calendar },
      // { name: 'Generate Schedule', href: '/committee/generate', icon: PlusCircle }, // DISABLED
      { name: 'Edit Schedule', href: '/committee/edit', icon: Edit3 },
      { name: 'Manage Rules', href: '/committee/rules', icon: Settings },
      { name: 'Course Management', href: '/committee/courses', icon: BookOpen },
      { name: 'Student Management', href: '/committee/students', icon: Users },
      { name: 'Comments & Feedback', href: '/committee/comments-feedback', icon: MessageSquare },
      
      { name: 'Create Irregular Student', href: '/committee/create-irregular-student', icon: AlertCircle },
      
      { name: 'Create User', href: '/admin/create-user', icon: UserPlus },
      { name: 'Analytics', href: '/committee/analytics', icon: BarChart3 },
    ]

    switch (userRole) {
      case 'admin':
      case 'scheduling_committee':
        return adminMenuItems
      
      case 'student':
        return [
          ...baseItems,
          { name: 'My Schedule', href: '/student/schedule', icon: Calendar },
          { name: 'Elective Preferences', href: '/student/electives', icon: BookOpen },
          { name: 'All Group Schedules', href: '/student/all-schedules', icon: Eye },
        ]
      
      case 'faculty':
        return [
          ...baseItems,
          { name: 'My Schedule', href: '/faculty/schedule', icon: Calendar },
        ]
      
      case 'teaching_load_committee':
        return [
          ...baseItems,
          { name: 'Review Schedules', href: '/committee/review', icon: Eye },
          { name: 'Instructor Loads', href: '/committee/loads', icon: BarChart3 },
          { name: 'Create User', href: '/admin/create-user', icon: UserPlus },
          { name: 'Feedback', href: '/committee/feedback', icon: MessageSquare },
        ]
      
      default:
        return baseItems
    }
  }

  const navigationItems = getNavigationItems()

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <div className={cn("flex h-full w-64 flex-col bg-white border-r", className)}>
      {/* Header */}
      <div className="flex h-16 items-center px-6 border-b">
        <div className="flex items-center space-x-2">
          <Calendar className="h-8 w-8 text-blue-600" />
          <span className="text-xl font-bold text-gray-900">Smart Scheduler</span>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src="" alt={user?.email} />
            <AvatarFallback>
              {user?.email?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.email}
            </p>
            <div className="flex items-center space-x-1">
              {getRoleIcon(userRole || '')}
              <Badge variant="secondary" className={cn("text-xs", getRoleColor(userRole || ''))}>
                {userRole?.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  isActive && "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                <item.icon className="mr-3 h-4 w-4" />
                {item.name}
              </Button>
            </Link>
          )
        })}
      </nav>

      <Separator />

      {/* User Menu */}
      <div className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start">
              <Settings className="mr-3 h-4 w-4" />
              Settings
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
