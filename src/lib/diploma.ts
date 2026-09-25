import { jsPDF } from 'jspdf'
import { fechaLarga } from './fechas'
import type { Diploma } from './supabase'

// Colores de marca: ajustar cuando esté el logo definitivo.
const PRIMARIO: [number, number, number] = [107, 44, 145]
const ACENTO: [number, number, number] = [214, 51, 132]
const TEXTO: [number, number, number] = [45, 45, 55]

interface Firmante {
  nombre: string
  cargo: string
  imagen?: string
}

// Quiénes firman todos los diplomas. La firma se dibuja con una fuente manuscrita;
// si existe la imagen indicada (firma escaneada, fondo transparente) se usa esa imagen.
// La mentora o el mentor de cada taller se agrega desde el panel.
const FIRMANTES: Firmante[] = [
  { nombre: 'Nairobi Nivar', cargo: 'Cofundadora, DigitalWomenRD', imagen: '/firma-nairobi.png' },
  { nombre: 'Idalys Ramirez', cargo: 'Cofundadora, DigitalWomenRD', imagen: '/firma-idalis.png' },
]

interface Imagen {
  data: string
  ancho: number
  alto: number
}

const imagenes = new Map<string, Promise<Imagen | null>>()

function cargarImagen(src: string): Promise<Imagen | null> {
  if (!imagenes.has(src)) imagenes.set(src, new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      resolve({ data: canvas.toDataURL('image/png'), ancho: img.naturalWidth, alto: img.naturalHeight })
    }
    img.onerror = () => resolve(null)
    img.src = src
  }))
  return imagenes.get(src)!
}

let fuenteFirma: Promise<string | null> | null = null

// Devuelve la fuente manuscrita en base64, como la pide jsPDF.
function cargarFuenteFirma(): Promise<string | null> {
  fuenteFirma ??= fetch('/fonts/GreatVibes-Regular.ttf')
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
    .then((buf) => {
      let bin = ''
      const bytes = new Uint8Array(buf)
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return btoa(bin)
    })
    .catch(() => null)
  return fuenteFirma
}

export async function descargarDiploma(d: Diploma) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const cx = W / 2

  // Marco
  doc.setDrawColor(...PRIMARIO)
  doc.setLineWidth(2.5)
  doc.rect(8, 8, W - 16, H - 16)
  doc.setDrawColor(...ACENTO)
  doc.setLineWidth(0.6)
  doc.rect(13, 13, W - 26, H - 26)

  // Logo (máx. 60 x 32 mm, manteniendo proporción)
  let y = 24
  const logo = await cargarImagen('/logo.png')
  if (logo) {
    const escala = Math.min(60 / logo.ancho, 32 / logo.alto)
    const w = logo.ancho * escala
    const h = logo.alto * escala
    doc.addImage(logo.data, 'PNG', cx - w / 2, y, w, h)
    y += h + 12
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(...PRIMARIO)
    doc.text('DigitalWomenRD', cx, y + 10, { align: 'center' })
    y += 24
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  doc.setTextColor(...PRIMARIO)
  doc.text('CERTIFICADO DE PARTICIPACIÓN', cx, y, { align: 'center' })

  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.setTextColor(...TEXTO)
  doc.text('DigitalWomenRD otorga el presente certificado a', cx, y, { align: 'center' })

  y += 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(...ACENTO)
  doc.text(d.nombre, cx, y, { align: 'center', maxWidth: W - 60 })

  y += 4
  doc.setDrawColor(...ACENTO)
  doc.setLineWidth(0.4)
  doc.line(cx - 80, y, cx + 80, y)

  y += 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.setTextColor(...TEXTO)
  doc.text('por su participación en el taller', cx, y, { align: 'center' })

  y += 11
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...PRIMARIO)
  const taller = doc.splitTextToSize(d.taller, W - 70)
  doc.text(taller, cx, y, { align: 'center' })

  y += 8 * taller.length + 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.setTextColor(...TEXTO)
  // Mes con mayúscula inicial: "25 de Septiembre de 2026".
  const fecha = fechaLarga(d.fecha).replace(/ de (\p{L})/u, (_, l: string) => ` de ${l.toUpperCase()}`)
  doc.text(`Realizado el ${fecha}.`, cx, y, { align: 'center' })

  // Firmas, repartidas a lo ancho. Si el taller tiene mentora o mentor, firma en el medio.
  const firmantes: Firmante[] = d.mentor
    ? [FIRMANTES[0], { nombre: d.mentor, cargo: `${d.mentor_titulo ?? 'Mentora'} del Taller` }, ...FIRMANTES.slice(1)]
    : FIRMANTES
  const tres = firmantes.length > 2
  const separacion = tres ? 88 : 130
  const mitadLinea = tres ? 36 : 40
  const yf = H - 32
  const fuente = await cargarFuenteFirma()
  if (fuente) {
    doc.addFileToVFS('GreatVibes-Regular.ttf', fuente)
    doc.addFont('GreatVibes-Regular.ttf', 'GreatVibes', 'normal')
  }
  for (const [i, f] of firmantes.entries()) {
    const x = cx + (i - (firmantes.length - 1) / 2) * separacion
    const firma = f.imagen ? await cargarImagen(f.imagen) : null
    if (firma) {
      const escala = Math.min(60 / firma.ancho, 18 / firma.alto)
      const w = firma.ancho * escala
      const h = firma.alto * escala
      doc.addImage(firma.data, 'PNG', x - w / 2, yf - h + 2, w, h)
    } else if (fuente) {
      doc.setFont('GreatVibes', 'normal')
      doc.setFontSize(tres ? 30 : 34)
      doc.setTextColor(30, 40, 90) // azul tinta
      doc.text(f.nombre, x, yf - 2, { align: 'center' })
    }
    doc.setDrawColor(...TEXTO)
    doc.setLineWidth(0.3)
    doc.line(x - mitadLinea, yf, x + mitadLinea, yf)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...TEXTO)
    doc.text(f.nombre, x, yf + 5, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(f.cargo, x, yf + 10, { align: 'center' })
  }

  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(`Código de verificación: ${d.id}`, W - 18, H - 16, { align: 'right' })

  const archivo = `Diploma - ${d.taller} - ${d.nombre}`.replace(/[\\/:*?"<>|]/g, '')
  doc.save(`${archivo}.pdf`)
}
