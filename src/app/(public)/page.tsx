// Not used — root page is app/page.tsx
// This file exists only to satisfy Next.js route group structure
import { redirect } from 'next/navigation'
export default function PublicRootPage() {
  redirect('/')
}
