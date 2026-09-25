import { normalizarCorreo } from './supabase'

export interface FilaImportada {
  nombre: string
  correo: string
  taller: string
  fecha: string
}

export interface ResultadoImportacion {
  filas: FilaImportada[]
  errores: string[]
}

// Acepta YYYY-MM-DD o DD/MM/YYYY (formato común de Excel en español).
export function normalizarFecha(valor: string): string | null {
  const v = valor.trim()
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

function separarLinea(linea: string, sep: string): string[] {
  const campos: string[] = []
  let actual = ''
  let entreComillas = false
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else {
        entreComillas = !entreComillas
      }
    } else if (c === sep && !entreComillas) {
      campos.push(actual)
      actual = ''
    } else {
      actual += c
    }
  }
  campos.push(actual)
  return campos.map((s) => s.trim())
}

/**
 * Columnas esperadas: nombre, correo, taller, fecha.
 * El separador puede ser coma o punto y coma. La fila de encabezado es opcional.
 */
export function parsearCsv(texto: string, tallerPorDefecto = '', fechaPorDefecto = ''): ResultadoImportacion {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  const filas: FilaImportada[] = []
  const errores: string[] = []
  if (lineas.length === 0) return { filas, errores }

  const sep = (lineas[0].match(/;/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const inicio = /correo|email/i.test(lineas[0]) ? 1 : 0

  for (let i = inicio; i < lineas.length; i++) {
    const [nombre = '', correo = '', taller = '', fecha = ''] = separarLinea(lineas[i], sep)
    const n = i + 1
    const tallerFinal = taller || tallerPorDefecto
    const fechaFinal = normalizarFecha(fecha || fechaPorDefecto)
    if (!nombre) errores.push(`Línea ${n}: falta el nombre`)
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.push(`Línea ${n}: correo inválido "${correo}"`)
    else if (!tallerFinal) errores.push(`Línea ${n}: falta el taller`)
    else if (!fechaFinal) errores.push(`Línea ${n}: fecha inválida "${fecha}"`)
    else filas.push({ nombre, correo: normalizarCorreo(correo), taller: tallerFinal, fecha: fechaFinal })
  }
  return { filas, errores }
}
