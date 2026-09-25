import { useState, type FormEvent } from 'react'
import { supabase, normalizarCorreo, type Diploma } from '../lib/supabase'
import { fechaLarga } from '../lib/fechas'

export default function Consulta() {
  const [correo, setCorreo] = useState('')
  const [diplomas, setDiplomas] = useState<Diploma[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [descargando, setDescargando] = useState<string | null>(null)

  async function buscar(e: FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError('')
    setDiplomas(null)
    const { data, error } = await supabase.rpc('buscar_diplomas', { p_correo: normalizarCorreo(correo) })
    setCargando(false)
    if (error) {
      setError('No pudimos consultar en este momento. Intenta de nuevo en unos minutos.')
      return
    }
    setDiplomas(data as Diploma[])
  }

  async function descargar(d: Diploma) {
    setDescargando(d.id)
    try {
      const { descargarDiploma } = await import('../lib/diploma')
      await descargarDiploma(d)
    } finally {
      setDescargando(null)
    }
  }

  return (
    <main className="contenedor estrecho">
      <header className="marca">
        <img src="/logo.png" alt="DigitalWomenRD" className="logo" onError={(e) => (e.currentTarget.style.display = 'none')} />
        <h1>Diplomas de participación</h1>
        <p className="sub">Escribe el correo con el que te inscribiste para descargar tus diplomas.</p>
      </header>

      <form className="tarjeta" onSubmit={buscar}>
        <label htmlFor="correo">Correo electrónico</label>
        <div className="fila">
          <input
            id="correo"
            type="email"
            required
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
          <button type="submit" disabled={cargando}>
            {cargando ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </form>

      {diplomas && diplomas.length === 0 && (
        <p className="tarjeta aviso">
          No encontramos talleres con ese correo. Revisa que esté bien escrito o escríbenos para verificarlo.
        </p>
      )}

      {diplomas && diplomas.length > 0 && (
        <section className="tarjeta">
          <h2>Hola, {diplomas[0].nombre}</h2>
          <ul className="lista-diplomas">
            {diplomas.map((d) => (
              <li key={d.id}>
                <div>
                  <strong>{d.taller}</strong>
                  <span className="sub">{fechaLarga(d.fecha)}</span>
                </div>
                <button onClick={() => descargar(d)} disabled={descargando === d.id}>
                  {descargando === d.id ? 'Generando…' : 'Descargar diploma'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
