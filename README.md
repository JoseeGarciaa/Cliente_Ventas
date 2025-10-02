# Sistema Ventas - Login Multi-Tenant

Este proyecto añade un login con multi-tenant (por esquema en PostgreSQL). Al iniciar sesión, el backend detecta el tenant por el correo del usuario en `admin_platform.user_tenants` y establece `search_path` a dicho esquema para aislar los datos por cliente.

## Requisitos
- Node 18+
- PostgreSQL accesible (Hostinger)

## Variables de entorno
Crea un archivo `.env` en la raíz copiando `.env.example` y ajusta los valores si es necesario.

## Instalación y ejecución (Windows PowerShell)
```powershell
# Instalar dependencias
npm install

# Iniciar el backend (Express en 3001)
npm run server

# En otra terminal, iniciar el frontend (Vite en 5173)
npm run dev
```

El frontend proxyará las peticiones `/api/*` al backend.

## Endpoints principales
- POST `/api/auth/login` { email, password }
- GET `/api/auth/me` (Bearer token)
- POST `/api/auth/logout`

## Notas de seguridad
- Cambia `JWT_SECRET` en `.env`.
- Se valida el nombre de esquema para evitar inyección.
- Si tus usuarios guardan contraseñas en claro, considera migrar a `password_hash` con bcrypt.

## Ajustes de base de datos
El servidor asume que existe un catálogo global `admin_platform.user_tenants(email, tenant_schema)` y que en cada esquema tenant existe una tabla `usuarios` con columnas:
- id, nombre, email, username
- password_hash (bcrypt) o password (texto, opcional)

Adapta el query en `server/index.js` según tu modelo real.

```
-- ejemplo mínimo
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text unique,
  username text unique not null,
  password_hash text,
  password text,
  created_at timestamptz default now()
);
```

## Estructura añadida
- `server/index.js`: API Express + PostgreSQL con `search_path` por tenant.
- `src/views/Login.tsx`: UI de login.
- `src/lib/api.ts`: helper de auth en el cliente.
- `vite.config.ts`: proxy `/api` a `http://localhost:3001` en dev.

## Producción (Nixpacks en Railway)
- El repo usa Nixpacks (railway.json + nixpacks.toml).
  1) Conecta tu repo de GitHub en Railway.
  2) Railway detectará Node y ejecutará:
    - npm ci
    - npm run build
    - start: node server/index.js
  3) Variables en Railway (Dashboard → Variables):
    - PGHOST, PGPORT=5432, PGDATABASE, PGUSER, PGPASSWORD, PGSSL=true
    - JWT_SECRET (valor seguro)
  4) No definas PORT (Railway la provee automática). El server usará process.env.PORT.

### Subir a GitHub (Windows PowerShell)
```powershell
git init
git add .
git commit -m "feat: login multi-tenant + backend express + deploy railway"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
git push -u origin main
```