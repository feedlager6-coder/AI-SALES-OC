import { redirect } from 'next/navigation'

// Root page — redirect to dashboard (middleware will catch unauthenticated users)
export default function RootPage() {
  redirect('/dashboard')
}
