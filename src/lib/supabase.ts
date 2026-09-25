import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configurado = Boolean(url && anonKey)

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'sin-configurar')

export interface Participante {
  id: string
  nombre: string
  correo: string
  taller: string
  fecha: string // YYYY-MM-DD
}

export type Diploma = Pick<Participante, 'id' | 'nombre' | 'taller' | 'fecha'>

export function normalizarCorreo(correo: string) {
  return correo.trim().toLowerCase()
}
