import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { configurado } from './lib/supabase'
import Consulta from './pages/Consulta'
import Admin from './pages/Admin'

export default function App() {
  if (!configurado) {
    return (
      <main className="contenedor estrecho">
        <p className="tarjeta aviso">
          Falta configurar Supabase: copia <code>.env.example</code> a <code>.env.local</code> y completa
          <code> VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
      </main>
    )
  }
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Consulta />} />
      </Routes>
    </BrowserRouter>
  )
}
