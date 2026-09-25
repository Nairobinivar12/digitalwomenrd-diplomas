const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// Se parsea a mano para evitar que la zona horaria corra la fecha un día.
export function fechaLarga(fecha: string) {
  const [a, m, d] = fecha.split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${a}`
}
