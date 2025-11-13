'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  History,
  CheckCircle,
  Clock,
  XCircle,
  Archive,
  Eye,
  GitCompare,
  Trash2,
  User,
  Calendar
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'

export interface ScheduleVersion {
  id: string
  level: number
  semester: string
  version_number: number
  status: 'draft' | 'approved' | 'active' | 'archived'
  is_active: boolean
  created_at: string
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  change_description: string | null
  conflicts: number
  efficiency: number | null
  total_sections: number
  created_by_user?: {
    id: string
    email: string
    full_name: string | null
  }
  approved_by_user?: {
    id: string
    email: string
    full_name: string | null
  }
}

interface VersionHistoryPanelProps {
  level: number
  semester: string
  onVersionSelect?: (versionId: string) => void
  onCompare?: (version1Id: string, version2Id: string) => void
}

export function VersionHistoryPanel({ level, semester, onVersionSelect, onCompare }: VersionHistoryPanelProps) {
  const { user } = useAuth()
  const [versions, setVersions] = useState<ScheduleVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadHistory()
  }, [level, semester])

  const loadHistory = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/schedule-versions/history?level=${level}&semester=${encodeURIComponent(semester)}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load version history')
      }

      setVersions(result.history || [])
    } catch (err: any) {
      setError(`Failed to load version history: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSetActive = async (versionId: string) => {
    try {
      setActionLoading(`set-active-${versionId}`)
      setError('')
      const response = await fetch(`/api/schedule-versions/${versionId}/set-active`, {
        method: 'POST'
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to set active version')
      }

      await loadHistory()
    } catch (err: any) {
      setError(`Failed to set active version: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleApprove = async (versionId: string) => {
    if (!user?.id) {
      setError('User not authenticated')
      return
    }

    try {
      setActionLoading(`approve-${versionId}`)
      setError('')
      const response = await fetch(`/api/schedule-versions/${versionId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ approved_by: user.id })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve version')
      }

      await loadHistory()
    } catch (err: any) {
      setError(`Failed to approve version: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (versionId: string) => {
    if (!confirm('Are you sure you want to delete this version? This action cannot be undone.')) {
      return
    }

    try {
      setActionLoading(`delete-${versionId}`)
      setError('')
      const response = await fetch(`/api/schedule-versions/${versionId}/delete`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete version')
      }

      await loadHistory()
    } catch (err: any) {
      setError(`Failed to delete version: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (isActive) {
      return (
        <Badge className="bg-green-100 text-green-700">
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </Badge>
      )
    }

    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-blue-100 text-blue-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      case 'archived':
        return (
          <Badge className="bg-gray-100 text-gray-700">
            <Archive className="h-3 w-3 mr-1" />
            Archived
          </Badge>
        )
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-700">
            <Clock className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        )
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">Loading version history...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Version History
        </CardTitle>
        <CardDescription>
          Level {level} • {semester}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {versions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No version history available</p>
          </div>
        ) : (
          <div className="space-y-2">
            {versions.map((version) => (
              <Card key={version.id} className={version.is_active ? 'border-green-200 bg-green-50' : ''}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">Version {version.version_number}</span>
                          {getStatusBadge(version.status, version.is_active)}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                          
                          </div>
                          {version.created_by_user && (
                            <div className="flex items-center gap-2">
                             {/* <User className="h-3 w-3" /> */}  
                            {/*{version.created_by_user.full_name || version.created_by_user.email} */}
                            </div>
                          )}
                         {/*} {version.change_description && (
                            <p className="text-xs text-gray-500 mt-1">{version.change_description}</p>
                           
                          )} */}
                            
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t">
                      {onVersionSelect && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onVersionSelect(version.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      )}
                     {/*} {onCompare && versions.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const otherVersion = versions.find(v => v.id !== version.id)
                            if (otherVersion) {
                              onCompare(version.id, otherVersion.id)
                            }
                          }}
                        >
                          <GitCompare className="h-4 w-4 mr-1" />
                          Compare
                        </Button>
                      )} */}
                      {!version.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetActive(version.id)}
                          disabled={actionLoading === `set-active-${version.id}` || actionLoading?.startsWith('approve-') || actionLoading?.startsWith('delete-')}
                        >
                          {actionLoading === `set-active-${version.id}` ? (
                            <>
                              <Clock className="h-4 w-4 mr-1 animate-spin" />
                              Setting...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Set Active
                            </>
                          )}
                        </Button>
                      )} 
                      {version.status !== 'approved' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApprove(version.id)}
                          disabled={actionLoading === `approve-${version.id}` || actionLoading?.startsWith('set-active-') || actionLoading?.startsWith('delete-')}
                        >
                          {actionLoading === `approve-${version.id}` ? (
                            <>
                              <Clock className="h-4 w-4 mr-1 animate-spin" />
                              Approving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                      )}
                      {!version.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(version.id)}
                          disabled={actionLoading === `delete-${version.id}` || actionLoading?.startsWith('set-active-') || actionLoading?.startsWith('approve-')}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {actionLoading === `delete-${version.id}` ? (
                            <>
                              <Clock className="h-4 w-4 mr-1 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

