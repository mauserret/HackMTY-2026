# HackMTY Admin

Panel web independiente para auditar usuarios, interfaces A2UI y
calificaciones. Está construido con React DOM, React Router, Axios y Vite; no
incluye React Native ni dependencias de Expo.

## Desarrollo local

Primero inicia el backend:

```bash
cd ../hackmty-backend
npm install
npm run seed:admin
npm start
```

Después inicia el panel:

```bash
cd ../hackmty-admin
npm install
npm run dev
```

Abre `http://localhost:5173`. Desde otro equipo en la misma red utiliza
`http://IP_LOCAL:5173`.

Credenciales requeridas para la demo:

- Usuario: `admin`
- Contraseña: `1`

Vite redirige `/api` a `http://localhost:4000`, por lo que la cookie de sesión
permanece en el mismo origen del navegador. Si el backend usa otra dirección,
copia `.env.example` a `.env` y cambia `VITE_BACKEND_URL`.

## Secciones

- **Resumen:** métricas generales, distribución de ratings, componentes y
  actividad reciente.
- **Usuarios:** búsqueda, volumen de interfaces y promedio por usuario.
- **Interfaces:** filtros por usuario, componente, prompt y estado de
  calificación; incluye el JSON A2UI completo.
- **Calificaciones:** distribución 1–10 y exploración de evaluaciones.

## API consumida

Todas las rutas salvo login requieren una cookie firmada `HttpOnly`:

- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/session`
- `GET /api/admin/overview`
- `GET /api/admin/users`
- `GET /api/admin/interactions`
- `GET /api/admin/interactions/:interactionId`
- `GET /api/admin/ratings`

## Build

```bash
npm run build
npm run preview
```

El servidor que publique `dist/` debe redirigir las rutas desconocidas a
`index.html` para que React Router pueda resolverlas.
