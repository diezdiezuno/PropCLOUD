import { redirect } from 'next/navigation'

// Contacto was merged into General → tab "Contacto"
export default function ContactoPage() {
  redirect('/admin/general')
}
