# Diplomas DigitalWomenRD

Portal para registrar participantes de talleres y que cada persona descargue su diploma de participación con su correo.

- **`/`** — vista pública: la persona escribe su correo y descarga un diploma (PDF) por cada taller en el que participó.
- **`/admin`** — panel protegido con usuario y contraseña: registrar, editar, eliminar e importar participantes desde CSV/Excel.

Stack: React + Vite + TypeScript, Supabase (base de datos y login) y jsPDF (el diploma se genera en el navegador). Hosting en Vercel. Todo en planes gratuitos.

## 1. Crear la base de datos (Supabase)

1. Crea una cuenta en <https://supabase.com> y un proyecto nuevo (región: *East US* es la más cercana a RD).
2. Ve a **SQL Editor → New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y dale **Run**.
   Antes, cambia al final del archivo el correo del administrador si no es `ingenieranairobi@gmail.com`.
3. Ve a **Authentication → Users → Add user → Create new user** y crea tu usuario admin con ese mismo correo y una contraseña. Marca *Auto Confirm User*.
4. Ve a **Authentication → Sign In / Providers** y **desactiva "Allow new users to sign up"** para que nadie más pueda crearse cuenta.
5. En **Project Settings → API** copia la *Project URL* y la clave *anon public*.

Para agregar otra administradora: crea su usuario en el paso 3 y agrega su correo en la tabla `administradores` (Table Editor).

**Roles:** ejecuta también [`supabase/roles.sql`](supabase/roles.sql). `superadmin` puede todo (incluido eliminar participantes y gestionar administradoras); `editor` registra, edita e importa, pero no elimina.

**Mentoras y mentores:** ejecuta también [`supabase/mentores.sql`](supabase/mentores.sql). En el panel se escribe la mentora o el mentor junto al taller y la fecha, y firma como tercera persona en todos los diplomas de ese taller.

## 2. Correr en local

```bash
cp .env.example .env.local   # y pega la URL y la clave anon
npm install
npm run dev
```

## 3. Publicar en Vercel

1. Entra a <https://vercel.com> con tu cuenta de GitHub → **Add New → Project** → importa `digitalwomenrd-diplomas`.
2. En **Environment Variables** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. **Deploy**. Cada `git push` a `main` vuelve a publicar automáticamente.

## Importar desde Excel

Guarda la hoja como **CSV** con las columnas `nombre, correo, taller, fecha` (fecha como `2026-09-20` o `20/09/2026`).
Si todas las personas son del mismo taller, puedes dejar solo `nombre, correo` y escribir el taller y la fecha en el formulario antes de importar.
Los registros repetidos (mismo correo, taller y fecha) se ignoran.

Si la primera fila tiene títulos, las columnas se reconocen por su nombre y en cualquier orden, así que el CSV de **Google Forms** se sube tal cual (*Respuestas → Vincular a Hojas de cálculo → Archivo → Descargar → CSV*). Se ignoran columnas como "Marca temporal", y si hay "Nombre" y "Apellido" por separado se unen.

## Logo y diseño del diploma

- El logo va en `public/logo.png` (se usa en la web y en el diploma).
- Colores y textos del diploma: [`src/lib/diploma.ts`](src/lib/diploma.ts). Colores de la web: [`src/index.css`](src/index.css).

## Nota sobre el plan gratuito de Supabase

Supabase pausa los proyectos gratuitos tras 7 días sin actividad. Se reactiva desde el panel de Supabase con un clic.
