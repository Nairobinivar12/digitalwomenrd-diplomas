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

// Acepta YYYY-MM-DD o DD/MM/YYYY (formato común de Excel en español),
// con o sin hora al final ("25/9/2026 14:30:00", como exporta Google Forms).
export function normalizarFecha(valor: string): string | null {
  const v = valor.trim().split(/[\sT]/)[0]
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

interface Columnas {
  nombre: number
  apellido: number
  correo: number
  taller: number
  fecha: number
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Ubica las columnas por su título, en cualquier orden (p. ej. el CSV de Google Forms:
 * "Marca temporal, Nombre completo, Dirección de correo electrónico, ...").
 * Las columnas que no reconoce, como "Marca temporal", se ignoran.
 */
function columnasPorTitulo(encabezado: string[]): Columnas {
  const t = encabezado.map(sinAcentos)
  const buscar = (re: RegExp, excluir: number[] = []) => t.findIndex((c, i) => re.test(c) && !excluir.includes(i))
  const correo = buscar(/correo|e-?mail/)
  const taller = buscar(/taller|curso|workshop/, [correo])
  const fecha = buscar(/^fecha|^date/, [correo, taller])
  const apellido = buscar(/apellido/, [correo, taller])
  const nombre = buscar(/nombre|name/, [correo, taller, apellido])
  return { nombre, apellido, correo, taller, fecha }
}

const POR_POSICION: Columnas = { nombre: 0, apellido: -1, correo: 1, taller: 2, fecha: 3 }
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FECHA_HORA = /^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/

/**
 * Sin fila de títulos. Si el correo no está en la segunda columna, se asume lo que sale al
 * copiar las respuestas de Google Sheets: [marca temporal], nombre, [apellido], correo, ...
 */
function columnasPorContenido(campos: string[]): Columnas {
  const correo = campos.findIndex((c) => CORREO.test(c))
  if (correo <= 1) return POR_POSICION
  const antes = campos.slice(0, correo).flatMap((c, i) => (c && !FECHA_HORA.test(c) ? [i] : []))
  return { nombre: antes[0] ?? -1, apellido: antes[1] ?? -1, correo, taller: -1, fecha: -1 }
}

// Palabra por palabra: "leyda segura" → "Leyda Segura", "MENDEZ PEÑA" → "Mendez Peña".
// Las palabras ya escritas con mayúscula inicial (p. ej. "D'oleo", "McDonald") se dejan igual,
// y las partículas en minúscula ("de", "del"...) se respetan.
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y'])
function capitalizar(nombre: string): string {
  return nombre
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((p, i) => {
      const todoMayus = p.length > 1 && p === p.toUpperCase() && p !== p.toLowerCase()
      const minuscula = p.charAt(0) !== p.charAt(0).toUpperCase()
      if (!todoMayus && !minuscula) return p
      if (i > 0 && PARTICULAS.has(p)) return p
      const base = p.toLowerCase()
      return base.charAt(0).toUpperCase() + base.slice(1)
    })
    .join(' ')
}

/**
 * Columnas: nombre, correo, taller, fecha. Si hay fila de títulos, las columnas se
 * reconocen por su nombre y en cualquier orden; si no, se toman en ese orden o se
 * deducen del contenido (respuestas de Google Forms copiadas del Sheet).
 * El separador puede ser coma, punto y coma o tabulación (al pegar desde Excel o Sheets).
 */
export function parsearCsv(texto: string, tallerPorDefecto = '', fechaPorDefecto = ''): ResultadoImportacion {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  const filas: FilaImportada[] = []
  const errores: string[] = []
  if (lineas.length === 0) return { filas, errores }

  const cuenta = (c: string) => lineas[0].split(c).length - 1
  const sep = cuenta('\t') > 0 ? '\t' : cuenta(';') > cuenta(',') ? ';' : ','
  // Fila de títulos: menciona el correo pero no trae ninguna dirección (sin "@").
  const conTitulos = /correo|e-?mail/i.test(lineas[0]) && !lineas[0].includes('@')
  const primera = separarLinea(lineas[0], sep)
  const col = conTitulos ? columnasPorTitulo(primera) : columnasPorContenido(primera)
  if (col.nombre < 0) errores.push('No se encontró una columna de nombre')
  if (col.nombre < 0 || col.correo < 0) return { filas, errores }

  for (let i = conTitulos ? 1 : 0; i < lineas.length; i++) {
    const campos = separarLinea(lineas[i], sep)
    const valor = (c: number) => (c >= 0 ? campos[c] ?? '' : '')
    const nombre = capitalizar([valor(col.nombre), valor(col.apellido)].filter(Boolean).join(' '))
    const correo = valor(col.correo)
    const taller = valor(col.taller)
    const fecha = valor(col.fecha)
    const n = i + 1
    const tallerFinal = taller || tallerPorDefecto
    const fechaFinal = normalizarFecha(fecha || fechaPorDefecto)
    if (!nombre) errores.push(`Línea ${n}: falta el nombre`)
    else if (!CORREO.test(correo)) errores.push(`Línea ${n}: correo inválido "${correo}"`)
    else if (!tallerFinal) errores.push(`Línea ${n}: falta el taller`)
    else if (!fechaFinal) errores.push(`Línea ${n}: fecha inválida "${fecha}"`)
    else filas.push({ nombre, correo: normalizarCorreo(correo), taller: tallerFinal, fecha: fechaFinal })
  }
  return { filas, errores }
}
