# Smart Scheduler

AI-powered university course scheduling system with conflict detection and resolution.

## Features

- 🤖 AI-powered schedule generation
- 📅 Multi-level course scheduling (Levels 1-4)
- 👥 Group-based scheduling (Groups A, B, C)
- ⚠️ Real-time conflict detection
- 🔧 AI-based conflict resolution
- 📊 Student timetable management
- 💬 Comment system for feedback
- 🎓 Elective course selection
- 📱 Responsive UI

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL), Next.js
- **AI:** Groq API for schedule generation
- **Authentication:** Supabase Auth

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   GROQ_API_KEY=your_groq_api_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## User Roles

- **Admin/Committee:** Generate and manage schedules, view conflicts, resolve issues
- **Student:** View personalized timetable, select electives, submit feedback



