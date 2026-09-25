import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  supabase,
  normalizarCorreo,
  claveTaller,
  type MentorTaller,
  type Participante,
  type TituloMentor,
} from '../lib/supabase'
import { fechaLarga } from '../lib/fechas'
import { parsearCsv } from '../lib/csv'

export default function Admin() {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setListo(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!listo) return null
  return sesion ? <Panel correo={sesion.user.email ?? ''} /> : <Login />
}

function Login() {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: normalizarCorreo(correo), password: clave })
    setCargando(false)
    if (error) setError('Correo o contraseña incorrectos.')
  }

  return (
    <main className="contenedor estrecho">
      <header className="marca">
        <img src="/logo.png" alt="DigitalWomenRD" className="logo" onError={(e) => (e.currentTarget.style.display = 'none')} />
        <h1>Administración</h1>
      </header>
      <form className="tarjeta" onSubmit={entrar}>
        <label htmlFor="c">Correo</label>
        <input id="c" type="email" required autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        <label htmlFor="p">Contraseña</label>
        <input id="p" type="password" required autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
        <button type="submit" disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  )
}

const VACIO = { nombre: '', correo: '', taller: '', fecha: '' }

function Panel({ correo }: { correo: string }) {
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null)
  const [esSuper, setEsSuper] = useState(false)
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [form, setForm] = useState(VACIO)
  const [editando, setEditando] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTaller, setFiltroTaller] = useState('')
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [csv, setCsv] = useState('')
  const [erroresCsv, setErroresCsv] = useState<string[]>([])
  const [mentores, setMentores] = useState<Map<string, MentorTaller>>(new Map())
  const [mentor, setMentor] = useState<{ nombre: string; titulo: TituloMentor }>({ nombre: '', titulo: 'Mentora' })
  const mentorAutocompletado = useRef('')

  async function cargar() {
    const [{ data, error }, { data: ms }] = await Promise.all([
      supabase
        .from('participantes')
        .select('id, nombre, correo, taller, fecha')
        .order('fecha', { ascending: false })
        .order('nombre'),
      supabase.from('mentores_taller').select('taller, fecha, nombre, titulo'),
    ])
    if (error) setMensaje({ tipo: 'error', texto: error.message })
    else setParticipantes(data)
    setMentores(new Map((ms ?? []).map((m: MentorTaller) => [claveTaller(m.taller, m.fecha), m])))
  }

  // Al escribir un taller y fecha que ya tienen mentora/mentor, se completa solo.
  // Si se cambia a otro taller sin mentor, se borra lo que se había completado solo.
  function cambiarTaller(taller: string, fecha: string) {
    setForm((f) => ({ ...f, taller, fecha }))
    const m = mentores.get(claveTaller(taller.trim(), fecha))
    if (m) {
      mentorAutocompletado.current = m.nombre
      setMentor({ nombre: m.nombre, titulo: m.titulo })
    } else if (mentorAutocompletado.current) {
      setMentor((actual) => (actual.nombre === mentorAutocompletado.current ? { ...actual, nombre: '' } : actual))
      mentorAutocompletado.current = ''
    }
  }

  // Guarda la mentora/mentor para cada taller y fecha indicados (si se escribió un nombre).
  async function guardarMentor(talleres: { taller: string; fecha: string }[]) {
    const nombre = mentor.nombre.trim()
    if (!nombre) return true
    const filas = [...new Map(talleres.map((t) => [claveTaller(t.taller, t.fecha), t])).values()].map((t) => ({
      ...t,
      nombre,
      titulo: mentor.titulo,
    }))
    const { error } = await supabase.from('mentores_taller').upsert(filas, { onConflict: 'taller,fecha' })
    if (error) setMensaje({ tipo: 'error', texto: `No se pudo guardar la mentora o el mentor: ${error.message}` })
    return !error
  }

  // Para poner o cambiar la mentora/mentor de un taller que ya tiene participantes registradas.
  async function guardarSoloMentor() {
    const taller = form.taller.trim()
    if (await guardarMentor([{ taller, fecha: form.fecha }])) {
      setMensaje({ tipo: 'ok', texto: `Listo: ${mentor.nombre.trim()} firma como ${mentor.titulo.toLowerCase()} de "${taller}".` })
      cargar()
    }
  }

  useEffect(() => {
    supabase.rpc('es_admin').then(({ data }) => {
      setEsAdmin(Boolean(data))
      if (data) cargar()
    })
    supabase.rpc('es_superadmin').then(({ data }) => setEsSuper(Boolean(data)))
  }, [])

  const talleres = useMemo(() => [...new Set(participantes.map((p) => p.taller))].sort(), [participantes])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return participantes.filter(
      (p) =>
        (!filtroTaller || p.taller === filtroTaller) &&
        (!q || p.nombre.toLowerCase().includes(q) || p.correo.includes(q)),
    )
  }, [participantes, busqueda, filtroTaller])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const fila = { ...form, nombre: form.nombre.trim(), taller: form.taller.trim(), correo: normalizarCorreo(form.correo) }
    const { error } = editando
      ? await supabase.from('participantes').update(fila).eq('id', editando)
      : await supabase.from('participantes').insert(fila)
    if (error) {
      setMensaje({
        tipo: 'error',
        texto: error.code === '23505' ? 'Esa persona ya está registrada en ese taller con esa fecha.' : error.message,
      })
      return
    }
    setMensaje({ tipo: 'ok', texto: editando ? 'Cambios guardados.' : `${fila.nombre} registrada.` })
    await guardarMentor([fila])
    // Se conservan taller y fecha para registrar a varias personas del mismo taller seguidas.
    setForm({ ...VACIO, taller: fila.taller, fecha: fila.fecha })
    setEditando(null)
    cargar()
  }

  function editar(p: Participante) {
    setEditando(p.id)
    setForm({ nombre: p.nombre, correo: p.correo, taller: p.taller, fecha: p.fecha })
    cambiarTaller(p.taller, p.fecha)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function eliminar(p: Participante) {
    if (!confirm(`¿Eliminar a ${p.nombre} del taller "${p.taller}"?`)) return
    const { error } = await supabase.from('participantes').delete().eq('id', p.id)
    if (error) setMensaje({ tipo: 'error', texto: error.message })
    else cargar()
  }

  async function importar() {
    const { filas, errores } = parsearCsv(csv, form.taller.trim(), form.fecha)
    setErroresCsv(errores)
    if (filas.length === 0) {
      setMensaje({ tipo: 'error', texto: 'No hay filas válidas para importar.' })
      return
    }
    const { data, error } = await supabase
      .from('participantes')
      .upsert(filas, { onConflict: 'correo,taller,fecha', ignoreDuplicates: true })
      .select('id')
    if (error) {
      setMensaje({ tipo: 'error', texto: error.message })
      return
    }
    const nuevas = data?.length ?? 0
    setMensaje({
      tipo: 'ok',
      texto: `Importadas ${nuevas} personas${filas.length > nuevas ? ` (${filas.length - nuevas} ya existían)` : ''}.`,
    })
    await guardarMentor(filas)
    if (errores.length === 0) setCsv('')
    cargar()
  }

  async function leerArchivo(archivo: File | undefined) {
    if (archivo) setCsv(await archivo.text())
  }

  if (esAdmin === null) return null
  if (!esAdmin) {
    return (
      <main className="contenedor estrecho">
        <p className="tarjeta aviso">
          La cuenta {correo} no tiene permiso de administración.{' '}
          <button className="enlace" onClick={() => supabase.auth.signOut()}>Salir</button>
        </p>
      </main>
    )
  }

  return (
    <main className="contenedor">
      <header className="barra">
        <div className="barra-marca">
          <img src="/logo.png" alt="" className="logo-mini" onError={(e) => (e.currentTarget.style.display = 'none')} />
          <h1>Administración de diplomas</h1>
        </div>
        <div>
          <span className="sub">{correo} · {esSuper ? 'superadmin' : 'editora'}</span>{' '}
          <button className="secundario" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </header>

      {mensaje && (
        <p className={mensaje.tipo === 'ok' ? 'exito' : 'error'} role="status">
          {mensaje.texto}
        </p>
      )}

      <div className="rejilla">
        <form className="tarjeta" onSubmit={guardar}>
          <h2>{editando ? 'Editar participante' : 'Registrar participante'}</h2>
          <label htmlFor="nombre">Nombre completo</label>
          <input id="nombre" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <label htmlFor="correo">Correo</label>
          <input id="correo" type="email" required value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
          <label htmlFor="taller">Taller</label>
          <input id="taller" required list="talleres" value={form.taller} onChange={(e) => cambiarTaller(e.target.value, form.fecha)} />
          <datalist id="talleres">
            {talleres.map((t) => <option key={t} value={t} />)}
          </datalist>
          <label htmlFor="fecha">Fecha del taller</label>
          <input id="fecha" type="date" required value={form.fecha} onChange={(e) => cambiarTaller(form.taller, e.target.value)} />
          <label htmlFor="mentor">Mentora o mentor del taller (opcional)</label>
          <div className="fila">
            <select
              aria-label="Título"
              value={mentor.titulo}
              onChange={(e) => setMentor({ ...mentor, titulo: e.target.value as TituloMentor })}
            >
              <option>Mentora</option>
              <option>Mentor</option>
            </select>
            <input
              id="mentor"
              placeholder="Nombre y apellido"
              value={mentor.nombre}
              onChange={(e) => setMentor({ ...mentor, nombre: e.target.value })}
            />
            <button
              type="button"
              className="secundario"
              disabled={!mentor.nombre.trim() || !form.taller.trim() || !form.fecha}
              onClick={guardarSoloMentor}
            >
              Guardar
            </button>
          </div>
          <p className="sub">Firma el diploma junto a las cofundadoras. Aplica a todo el taller de esa fecha.</p>
          <div className="fila">
            <button type="submit">{editando ? 'Guardar cambios' : 'Registrar'}</button>
            {editando && (
              <button type="button" className="secundario" onClick={() => { setEditando(null); setForm(VACIO) }}>
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="tarjeta">
          <h2>Importar lista (CSV)</h2>
          <p className="sub">
            Columnas: <code>nombre, correo, taller, fecha</code>, en cualquier orden si la primera fila tiene los
            títulos. Si la lista no tiene taller o fecha, se usan los del formulario de la izquierda. En Excel:{' '}
            <em>Guardar como → CSV</em>. En Google Forms: <em>Respuestas → Hojas de cálculo → Archivo → Descargar → CSV</em>,
            o copia las filas del Sheet y pégalas aquí abajo.
          </p>
          <input type="file" accept=".csv,text/csv" onChange={(e) => leerArchivo(e.target.files?.[0])} />
          <textarea
            rows={6}
            placeholder={'nombre,correo,taller,fecha\nAna Pérez,ana@correo.com,Introducción a Python,2026-09-20'}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <button type="button" onClick={importar} disabled={!csv.trim()}>Importar</button>
          {erroresCsv.length > 0 && (
            <ul className="error">
              {erroresCsv.map((er) => <li key={er}>{er}</li>)}
            </ul>
          )}
        </div>
      </div>

      <section className="tarjeta">
        <div className="barra">
          <h2>Participantes ({visibles.length})</h2>
          <div className="fila">
            <input placeholder="Buscar nombre o correo" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            <select value={filtroTaller} onChange={(e) => setFiltroTaller(e.target.value)}>
              <option value="">Todos los talleres</option>
              {talleres.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Taller</th>
                <th>Fecha</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td>{p.correo}</td>
                  <td>{p.taller}</td>
                  <td>{fechaLarga(p.fecha)}</td>
                  <td className="acciones">
                    <button className="enlace" onClick={() => {
                        const m = mentores.get(claveTaller(p.taller, p.fecha))
                        import('../lib/diploma').then((d) =>
                          d.descargarDiploma({ ...p, mentor: m?.nombre, mentor_titulo: m?.titulo }),
                        )
                      }}>Ver diploma</button>
                    <button className="enlace" onClick={() => editar(p)}>Editar</button>
                    {esSuper && <button className="enlace peligro" onClick={() => eliminar(p)}>Eliminar</button>}
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={5} className="sub">Sin participantes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
