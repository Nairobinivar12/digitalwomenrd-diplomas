import { jsPDF } from 'jspdf'
import { fechaLarga } from './fechas'
import type { Diploma } from './supabase'

// Colores de marca: ajustar cuando esté el logo definitivo.
const PRIMARIO: [number, number, number] = [107, 44, 145]
const ACENTO: [number, number, number] = [214, 51, 132]
const TEXTO: [number, number, number] = [45, 45, 55]

interface Imagen {
  data: string
  ancho: number
  alto: number
}

let logoCache: Promise<Imagen | null> | null = null

function cargarLogo(): Promise<Imagen | null> {
  logoCache ??= new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      resolve({ data: canvas.toDataURL('image/png'), ancho: img.naturalWidth, alto: img.naturalHeight })
    }
    img.onerror = () => resolve(null)
    img.src = '/logo.png'
  })
  return logoCache
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
  const logo = await cargarLogo()
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
  const taller = doc.splitTextToSize(`«${d.taller}»`, W - 70)
  doc.text(taller, cx, y, { align: 'center' })

  y += 8 * taller.length + 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.setTextColor(...TEXTO)
  doc.text(`realizado el ${fechaLarga(d.fecha)}.`, cx, y, { align: 'center' })

  // Firma
  const yf = H - 30
  doc.setDrawColor(...TEXTO)
  doc.setLineWidth(0.3)
  doc.line(cx - 40, yf, cx + 40, yf)
  doc.setFontSize(11)
  doc.text('DigitalWomenRD', cx, yf + 6, { align: 'center' })

  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(`Código de verificación: ${d.id}`, W - 18, H - 17, { align: 'right' })

  const archivo = `Diploma - ${d.taller} - ${d.nombre}`.replace(/[\\/:*?"<>|]/g, '')
  doc.save(`${archivo}.pdf`)
}
