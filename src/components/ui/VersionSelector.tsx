'use client'

import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ScheduleVersion {
  id: string
  version_number: number
  status: 'draft' | 'approved' | 'active' | 'archived'
  is_active: boolean
  created_at: string
  change_description: string | null
}

interface VersionSelectorProps {
  level: number
  semester: string
  value?: string
  onValueChange?: (versionId: string) => void
  includeAll?: boolean
}

export function VersionSelector({ level, semester, value, onValueChange, includeAll = false }: VersionSelectorProps) {
  const [versions, setVersions] = useState<ScheduleVersion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadVersions()
  }, [level, semester])

  const loadVersions = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/schedule-versions/history?level=${level}&semester=${encodeURIComponent(semester)}`)
      const result = await response.json()

      if (response.ok && result.history) {
        setVersions(result.history)
        
        // Set default to active version if no value provided
        if (!value && result.history.length > 0) {
          const activeVersion = result.history.find((v: ScheduleVersion) => v.is_active)
          if (activeVersion && onValueChange) {
            onValueChange(activeVersion.id)
          }
        }
      }
    } catch (error) {
      console.error('Error loading versions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getVersionLabel = (version: ScheduleVersion) => {
    const date = formatDistanceToNow(new Date(version.created_at), { addSuffix: true })
    const statusBadge = version.is_active ? (
      <Badge className="ml-2 bg-green-100 text-green-700 text-xs">
        <CheckCircle className="h-2 w-2 mr-1" />
        Active
      </Badge>
    ) : version.status === 'approved' ? (
      <Badge className="ml-2 bg-blue-100 text-blue-700 text-xs">Approved</Badge>
    ) : null

    return (
      <div className="flex items-center">
        <span>v{version.version_number}</span>
        {statusBadge}
        <span className="ml-2 text-xs text-gray-500">{date}</span>
      </div>
    )
  }

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Loading versions..." />
        </SelectTrigger>
      </Select>
    )
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select version">
          {value && versions.find(v => v.id === value) && (
            <span>Version {versions.find(v => v.id === value)?.version_number}</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {includeAll && (
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <span>All Versions</span>
            </div>
          </SelectItem>
        )}
        {versions.map((version) => (
          <SelectItem key={version.id} value={version.id}>
            {getVersionLabel(version)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

