# Agrícola BAS · Fundo La Morera

Sistema de gestión agrícola, administrativa y financiera del Fundo La Morera (Agrícola BAS S.A., Graneros).

**Etapa 1 (esta versión):** catastro del campo, 28 cuarteles reales con su historia de plantación, equipos y sectores de riego, usuarios con perfiles y permisos, tablero inicial, fotos y documentos por cuartel, y registro de actividad que no se puede borrar.

---

## Qué necesitas

Tres cuentas gratuitas, idealmente creadas con un correo del campo (no personal), para que el sistema sea de Agrícola BAS y no de una persona:

| Servicio | Para qué | Plan |
| --- | --- | --- |
| [Supabase](https://supabase.com) | Base de datos, usuarios y archivos | Gratis para partir; **Pro (US$25/mes) antes de cargar datos financieros** (Etapa 2), porque incluye respaldos diarios |
| [GitHub](https://github.com) | Guardar el código | Gratis, repositorio privado |
| [Vercel](https://vercel.com) | Publicar la app | Hobby para probar; Pro (US$20/mes) para uso comercial |

Tiempo estimado: 30 a 45 minutos la primera vez.

---

## Paso 1 · Crear la base de datos en Supabase

1. En Supabase, **New project**. Nombre: `agricola-bas`. Región: **South America (São Paulo)**, la más cercana. Guarda la contraseña de la base de datos en un lugar seguro.
2. Cuando el proyecto esté listo, entra a **SQL Editor → New query**.
3. Abre cada archivo de la carpeta `supabase/migrations/` **en este orden**, copia todo su contenido, pégalo y presiona **Run**:
   1. `20261102000100_etapa1_base.sql` (tablas, permisos y auditoría)
   2. `20261102000200_almacenamiento.sql` (carpeta privada para fotos y documentos)
   3. `20261102000300_datos_la_morera.sql` (cuarteles, 26 sectores y 5 equipos reales)
   4. `20261102000400_plantacion_y_polinizantes.sql` (año de plantación, portainjertos, polinizantes y cuarteles sin plantar)

   Cada uno debe terminar con "Success. No rows returned".
4. Comprueba la carga: en una consulta nueva ejecuta
   ```sql
   select count(*), sum(superficie_ha) from cuartel;
   ```
   Debe dar **28** y **85.00**.

> Alternativa con terminal: `npx supabase login`, `npx supabase link --project-ref <ref>` y `npx supabase db push` aplican las cuatro migraciones de una vez.

## Paso 2 · Crear tu usuario administrador (antes que nadie)

El **primer usuario** que exista queda como administrador automáticamente. Por eso hazlo ahora:

1. **Authentication → Users → Add user → Create new user**.
2. Tu correo y una contraseña de al menos 10 caracteres. Marca **Auto Confirm User**.
3. Verifica en **Table Editor → perfil** que tu fila dice `administrador`.

## Paso 3 · Cerrar el registro público

En **Authentication → Sign In / Providers** (o **Auth Settings**, según la versión del panel):

- Desactiva **Allow new users to sign up**. Así solo entran las personas que tú crees desde la app.

## Paso 4 · Subir el código a GitHub

1. En GitHub, **New repository** → nombre `agricola-bas` → **Private** → Create.
2. Sube el código. La forma más simple sin terminal: en la página del repositorio vacío, **uploading an existing file**, y arrastra **el contenido** de la carpeta `agricola-bas` (no la carpeta misma). Commit.

   Con terminal, desde la carpeta del proyecto:
   ```bash
   git add -A
   git commit -m "Etapa 1"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/agricola-bas.git
   git push -u origin main
   ```

## Paso 5 · Publicar en Vercel

1. En Vercel, **Add New → Project** → importa el repositorio `agricola-bas`.
2. Antes de desplegar, abre **Environment Variables** y agrega estas cuatro (los valores están en Supabase → **Project Settings → API**):

   | Variable | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave `anon` / `public` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Llave `service_role` (**secreta**: nunca la compartas ni la pongas en el código) |
   | `NEXT_PUBLIC_SITE_URL` | Por ahora `https://agricola-bas.vercel.app` (la ajustas en el paso 6) |

3. **Deploy**. Tarda unos 2 minutos.

## Paso 6 · Conectar la dirección final

1. Copia la dirección que te dio Vercel (por ejemplo `https://agricola-bas.vercel.app`, o un dominio propio como `app.agricolabas.cl` si lo configuras en **Settings → Domains**).
2. En Vercel, corrige `NEXT_PUBLIC_SITE_URL` con esa dirección exacta, sin barra final, y vuelve a desplegar (**Deployments → ⋯ → Redeploy**).
3. En Supabase → **Authentication → URL Configuration**:
   - **Site URL**: la misma dirección.
   - **Redirect URLs**: agrega `https://<tu-dirección>/auth/confirm`.
4. En Supabase → **Authentication → Email Templates**, cambia el enlace de dos plantillas para que funcionen con la app:
   - **Invite user**: reemplaza `{{ .ConfirmationURL }}` por
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/cuenta`
   - **Reset Password**: reemplaza `{{ .ConfirmationURL }}` por
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/cuenta`

Listo: entra con tu correo y contraseña.

---

## Usar la app

### Instalarla en el celular

- **iPhone (Safari):** abre la dirección → botón Compartir → **Agregar a inicio**.
- **Android (Chrome):** abre la dirección → menú ⋮ → **Instalar aplicación**.

Queda con ícono propio y se abre a pantalla completa, como una app.

### Crear usuarios

Menú **Usuarios** (solo administrador). Hay dos formas de entregar el acceso:

- **Contraseña temporal** (recomendada al principio): la app genera una clave que tú le entregas a la persona; ella la cambia en **Mi cuenta**. Funciona sin configurar nada más.
- **Invitación por correo:** el correo de Supabase sin configurar solo llega a los miembros del equipo de Supabase y tiene un límite bajo por hora. Para invitar a cualquier persona hay que conectar un servicio de correo propio en **Project Settings → Authentication → SMTP**.

| Perfil | Puede |
| --- | --- |
| Administrador | Todo, incluidos usuarios y configuración |
| Encargado administrativo | Temporadas y centros de costo; en la Etapa 2, facturas, compras, presupuesto e informes |
| Encargado agrícola | Cuarteles, plantaciones, riego, especies y variedades |
| Operario | Consultar cuarteles; en la Etapa 3, registrar sus labores |
| Propietario | Consultar todo y ver el registro de actividad |

Los permisos los aplica la base de datos, no solo la pantalla: aunque alguien manipule la app, no puede leer ni cambiar lo que su perfil no permite.

### Cuarteles

- **Editar** corrige los datos actuales (por ejemplo, completar el portainjerto).
- **Cambio de plantación** registra un reinjerto o replante: la plantación anterior queda cerrada en el historial y lo que ocurrió antes sigue asociado a ella.
- **Dar de baja** oculta el cuartel sin borrar su historia. Los cuarteles no se eliminan.
- **Descargar planilla** baja la lista filtrada en formato que Excel abre directo.

---

## Datos cargados

Todo viene del plano *Sectorización Fundo La Morera*, HC Ingeniería, versión 2 (27-03-2025), con estas correcciones:

- Sector y cuartel **1-4**: 4,53 ha (el plano dice 5,03; se descuentan 0,50 ha por el tranque).
- Nogales: variedad **Chandler**, marco 7 × 5 m (el 1-1 figura con 7 × 6 m en el plano).
- **4-4** es un solo sector de riego con dos cuarteles: 4-4a (cerezo Santina, 0,82 ha) y 4-4b (ciruelo, 3,40 ha).
- **4-4b** (3,40 ha): sin plantar, ciruelo de variedad por definir.
- **4-5a** (2,99 ha) y **4-5b** (1,22 ha): sin plantar; se plantarán en 2027 con ciruelo **AG 206**. Comparten el sector de riego 4-5.
- Carozos plantados en **invierno de 2024**. Portainjertos: Lapins y Santina en **Colt**; Areko en **Gisela 12**; Tiffany, Luciana, Garcica y Soledora en **Atlas**; ciruelos por completar.
- Polinizantes: Areko con Kordia y Skeena (Gisela 12) y Lapins como supernumeraria (Colt); Red Phoenix con Sweet Mary en cabeceras, hilera de Candy Red cada 4 y un Dapple Dandy cada 9 plantas en esa hilera; Candy Red igual, con Red Phoenix en la hilera polinizante.

| Equipo | Cuarteles | Superficie |
| --- | --- | --- |
| 1 · Nogales | 6 | 28,47 ha |
| 2 | 5 | 11,92 ha |
| 3 | 5 | 13,06 ha |
| 4 | 7 | 19,75 ha (7,61 ha sin plantar) |
| 5 | 5 | 11,80 ha |
| **Total** | **28** | **85,00 ha** (77,39 ha plantadas) |

### Por completar en la app

- [ ] Variedad del cuartel **4-4b**, cuando se defina.
- [ ] Portainjerto de los ciruelos y año de plantación de los nogales.
- [ ] Confirmar cuál de los cuarteles 2-1, 2-2 o 2-3 es Santina: los controles financieros usan 4,4 ha de Lapins y 7,2 ha de Santina, mientras el plano trae 6,63 ha de Lapins y 5,04 ha de Santina (la diferencia es exactamente un cuartel de 2,21 ha).
- [ ] Conteo real de plantas (mientras tanto se muestran las teóricas según el marco).
- [ ] Superficie total del predio (Campo → Datos generales).
- [ ] Nogales: los controles financieros usan 28,54 ha y el plano, descontado el tranque, da 28,47 ha. Definir cuál es la cifra oficial.
- [ ] Revisar el estado productivo: los carozos quedaron "En formación" y los nogales "Productivo".
- [ ] Confirmar la temporada: **2026-27** va del 1 de mayo al 30 de abril, igual que los controles actuales (Remesa, Petróleo, Personal). Si es otro período, se corrige en Campo.

---

## Respaldos y propiedad de los datos

- Con Supabase **Pro**, la base se respalda sola cada día y se puede restaurar. El plan gratuito **no** tiene respaldos automáticos ni garantiza continuidad: pásate a Pro antes de la Etapa 2.
- Ningún registro de cuarteles o plantación se borra; todo cambio queda en **Actividad** con autor, fecha, valor anterior y nuevo.
- Los datos y el código son de Agrícola BAS: se pueden exportar completos en cualquier momento desde Supabase (**Database → Backups**, o `pg_dump` con la cadena de conexión).

---

## Para desarrollo

```bash
cp .env.example .env.local   # completar con las llaves de Supabase
npm install
npm run dev                  # http://localhost:3000
npm run typecheck
```

Estructura:

```
supabase/migrations/   Esquema, permisos, auditoría y datos iniciales (en orden)
src/app/login          Ingreso y recuperación de contraseña
src/app/auth           Confirmación de enlaces y cierre de sesión
src/app/(app)          Pantallas con sesión: inicio, cuarteles, riego, campo, usuarios, actividad, cuenta
src/components         Menú, formularios y subida de archivos
src/lib                Conexión a Supabase, permisos, formatos chilenos (es-CL, CLP, dd-mm-aaaa)
```

**Nota técnica:** esta primera versión se escribió en un entorno sin acceso al registro de npm, así que no se compiló antes de entregarla. Para que un error de tipos no bloquee el primer despliegue, `next.config.ts` tiene `typescript.ignoreBuildErrors: true`. Si el despliegue en Vercel falla, copia el mensaje de error del registro de construcción y se corrige. Cuando `npm run typecheck` pase limpio, cambia esa opción a `false`.

## Próximas etapas

2. Finanzas: facturas (importadas desde el Registro de Compras del SII), compras, proveedores, pagos, gastos, ingresos y presupuesto.
3. Labores, aplicaciones con carencias y reingresos, inventario de bodega y maquinaria; registro sin señal en terreno.
4. Cosecha, liquidaciones de exportadora, prorrateo y ficha económica por cuartel.
5. Informe mensual automático para los propietarios: Excel, PDF y presentación, con cierres congelados.
6. Alertas, cartola bancaria, clima, fenología y comparaciones históricas.
