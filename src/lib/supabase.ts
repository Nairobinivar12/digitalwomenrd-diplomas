import { createClient } from '@supabase/supabase-js'

// trim(): al pegar los valores en Vercel suelen colarse espacios o saltos de línea.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const configurado = Boolean(url && anonKey)

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'sin-configurar')

export interface Participante {
  id: string
  nombre: string
  correo: string
  taller: string
  fecha: string // YYYY-MM-DD
}

export type TituloMentor = 'Mentora' | 'Mentor'

export interface MentorTaller {
  taller: string
  fecha: string
  nombre: string
  titulo: TituloMentor
}

export type Diploma = Pick<Participante, 'id' | 'nombre' | 'taller' | 'fecha'> & {
  mentor?: string | null
  mentor_titulo?: TituloMentor | null
}

export const claveTaller = (taller: string, fecha: string) => `${taller}|${fecha}`

export function normalizarCorreo(correo: string) {
  return correo.trim().toLowerCase()
}
