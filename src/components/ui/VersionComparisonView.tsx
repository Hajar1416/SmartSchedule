'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { X, GitCompare, Plus, Minus, Edit } from 'lucide-react'
import { ScheduleVersionService, ScheduleVersion } from '@/lib/scheduleVersionService'

interface VersionComparisonViewProps {
  version1Id: string
  version2Id: string
  onClose?: () => void
}

export function VersionComparisonView({ version1Id, version2Id, onClose }: VersionComparisonViewProps) {
  const [version1, setVersion1] = useState<ScheduleVersion | null>(null)
  const [version2, setVersion2] = useState<ScheduleVersion | null>(null)
  const [diff, setDiff] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadComparison()
  }, [version1Id, version2Id])

  const loadComparison = async () => {
    try {
      setLoading(true)
      setError('')

      // Load both versions
      const [v1, v2] = await Promise.all([
        ScheduleVersionService.getVersionById(version1Id),
        ScheduleVersionService.getVersionById(version2Id)
      ])

      if (!v1 || !v2) {
        throw new Error('One or both versions not found')
      }

      setVersion1(v1)
      setVersion2(v2)

      // Get diff
      const diffData = await ScheduleVersionService.compareVersions(version1Id, version2Id)
      setDiff(diffData)
    } catch (err: any) {
      setError(`Failed to load comparison: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const extractSections = (version: ScheduleVersion) => {
    const sections: any[] = []
    if (!version.groups || typeof version.groups !== 'object') {
      return sections
    }

    Object.entries(version.groups).forEach(([groupName, groupData]: [string, any]) => {
      if (groupData && groupData.sections && Array.isArray(groupData.sections)) {
        groupData.sections.forEach((section: any) => {
          sections.push({
            ...section,
            group_name: groupName,
            key: `${section.course_code}-${section.section_label}-${groupName}`
          })
        })
      }
    })

    return sections.sort((a, b) => {
      if (a.day !== b.day) return a.day.localeCompare(b.day)
      if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time)
      return a.course_code.localeCompare(b.course_code)
    })
  }

  /*if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Comparing Versions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">Loading comparison...</div>
        </CardContent>
      </Card>
    )
  }
    */

  if (error || !version1 || !version2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Version Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error || 'Failed to load versions'}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const sections1 = extractSections(version1)
  const sections2 = extractSections(version2)

  // Create maps for quick lookup
  const sections1Map = new Map(sections1.map(s => [s.key, s]))
  const sections2Map = new Map(sections2.map(s => [s.key, s]))

  // Get all unique keys
  const allKeys = new Set([...sections1Map.keys(), ...sections2Map.keys()])

  const getSectionStatus = (key: string) => {
    const hasV1 = sections1Map.has(key)
    const hasV2 = sections2Map.has(key)

    if (!hasV1 && hasV2) return 'added'
    if (hasV1 && !hasV2) return 'removed'
    if (hasV1 && hasV2) {
      const s1 = sections1Map.get(key)!
      const s2 = sections2Map.get(key)!
      if (
        s1.day !== s2.day ||
        s1.start_time !== s2.start_time ||
        s1.end_time !== s2.end_time ||
        s1.room !== s2.room ||
        s1.instructor !== s2.instructor
      ) {
        return 'modified'
      }
    }
    return 'unchanged'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              Version Comparison
            </CardTitle>
            <CardDescription>
              Version {version1.version_number} vs Version {version2.version_number}
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm font-medium text-gray-600 mb-2">Version {version1.version_number}</div>
              <div className="space-y-1 text-sm">
                <div>Sections: {version1.total_sections}</div>
                <div>Conflicts: {version1.conflicts}</div>
                {version1.efficiency !== null && <div>Efficiency: {version1.efficiency.toFixed(1)}%</div>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm font-medium text-gray-600 mb-2">Version {version2.version_number}</div>
              <div className="space-y-1 text-sm">
                <div>Sections: {version2.total_sections}</div>
                <div>Conflicts: {version2.conflicts}</div>
                {version2.efficiency !== null && <div>Efficiency: {version2.efficiency.toFixed(1)}%</div>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Diff Summary */}
        {diff && (
          <Alert>
            <AlertDescription>
              <div className="space-y-1 text-sm">
                <div><strong>Changes:</strong></div>
                <div>Added: {diff.added_sections.length} sections</div>
                <div>Removed: {diff.removed_sections.length} sections</div>
                <div>Modified: {diff.modified_sections.length} sections</div>
                <div>Conflicts: {diff.conflicts_diff > 0 ? '+' : ''}{diff.conflicts_diff}</div>
                {diff.efficiency_diff !== 0 && (
                  <div>Efficiency: {diff.efficiency_diff > 0 ? '+' : ''}{diff.efficiency_diff.toFixed(1)}%</div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Side-by-side Sections */}
        <div className="grid grid-cols-2 gap-4">
          {/* Version 1 */}
          <div>
            <div className="font-semibold mb-2 text-sm">Version {version1.version_number}</div>
            <div className="space-y-2 max-h-96 overflow-y-auto border rounded p-2">
              {sections1.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No sections</div>
              ) : (
                sections1.map((section) => {
                  const status = getSectionStatus(section.key)
                  const bgColor = 
                    status === 'removed' ? 'bg-red-50 border-red-200' :
                    status === 'modified' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-white border-gray-200'

                  return (
                    <Card key={section.key} className={`${bgColor} mb-2`}>
                      <CardContent className="p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{section.course_code}</span>
                          {status === 'removed' && <Minus className="h-3 w-3 text-red-600" />}
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <div>{section.day} {section.start_time}-{section.end_time}</div>
                          <div>Room: {section.room}</div>
                          {section.instructor && <div>Instructor: {section.instructor}</div>}
                          <div>Group: {section.group_name}</div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </div>

          {/* Version 2 */}
          <div>
            <div className="font-semibold mb-2 text-sm">Version {version2.version_number}</div>
            <div className="space-y-2 max-h-96 overflow-y-auto border rounded p-2">
              {sections2.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No sections</div>
              ) : (
                sections2.map((section) => {
                  const status = getSectionStatus(section.key)
                  const bgColor = 
                    status === 'added' ? 'bg-green-50 border-green-200' :
                    status === 'modified' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-white border-gray-200'

                  return (
                    <Card key={section.key} className={`${bgColor} mb-2`}>
                      <CardContent className="p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{section.course_code}</span>
                          {status === 'added' && <Plus className="h-3 w-3 text-green-600" />}
                          {status === 'modified' && <Edit className="h-3 w-3 text-yellow-600" />}
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <div>{section.day} {section.start_time}-{section.end_time}</div>
                          <div>Room: {section.room}</div>
                          {section.instructor && <div>Instructor: {section.instructor}</div>}
                          <div>Group: {section.group_name}</div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs pt-2 border-t">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
            <span>Added</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
            <span>Removed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-100 border border-yellow-200 rounded"></div>
            <span>Modified</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

