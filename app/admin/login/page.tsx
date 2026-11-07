import type { Metadata } from 'next'
import { LoginForm } from '@/components/LoginForm'
import { Logo } from '@/components/Header'

export const metadata: Metadata = { title: 'Masuk' }

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6 flex justify-center"><Logo size={44} /></div>
      <div className="panel-solid">
        <h1 className="text-xl font-extrabold">Masuk admin</h1>
        <p className="muted mt-1 text-sm">Khusus tim review setoran.</p>
        <LoginForm />
      </div>
    </main>
  )
}
