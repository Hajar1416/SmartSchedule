'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/MainLayout'

export default function FacultyDashboard() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to schedules page
    router.push('/faculty/schedule')
  }, [router])

  return (
    <MainLayout>
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-600">Redirecting to schedules...</p>
      </div>
    </MainLayout>
  )
}

