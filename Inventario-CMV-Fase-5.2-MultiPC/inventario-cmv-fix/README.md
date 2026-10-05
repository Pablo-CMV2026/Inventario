# Inventario CMV — Fases 1 a 5

Base técnica del inventario institucional del Colegio Manso de Velasco.

## Estado actual

### Fase 1 — Fundación
- React + TypeScript + Vite.
- Identidad visual CMV (`#0F5A36` / `#E8C547`).
- Responsive para computador e iPhone.
- Supabase Auth por email/contraseña.
- Recuperación de contraseña.
- Roles: `superadmin`, `inventory_admin`, `viewer`.
- Sin registro público.
- Navegación base.

### Fase 2 — Datos e integridad
- Modelo PostgreSQL V1.
- Categorías, dependencias jerárquicas, custodios y financiamiento.
- Tandas y etiquetas CMV permanentes.
- Bienes con condición física, situación operativa y ciclo de vida separados.
- Adquisiciones y valor individual.
- Movimientos históricos y auditoría.
- Recorridos/verificaciones preparados en datos.
- Archivos privados preparados.
- Bloqueo de borrado físico.
- RLS.
- RPC atómicas para tandas, anulación de etiquetas y alta de un bien.

### Fase 3 — Inventario básico conectado
- Dashboard con datos reales.
- Configuración mínima de categorías, dependencias y responsables.
- Listado y búsqueda de inventario.
- Filtros por categoría, dependencia y ciclo de vida.
- Alta real desde una etiqueta disponible mediante RPC atómica.
- Ficha del bien.
- Historial de movimientos.
- Ingreso manual de código.

### Fase 4 — Etiquetas
- Generación de tandas desde la interfaz.
- Estados `available`, `assigned` y `voided` visibles.
- Anulación permanente con motivo.
- Impresión compacta inicial de 50 × 30 mm.
- QR + código `CMV-XXXXXX`, sin logo ni datos variables.
- Impresión de tanda solo para etiquetas disponibles.
- Reimpresión individual de etiquetas disponibles o asignadas.
- Etiquetas anuladas excluidas de toda impresión.
- Contadores trazables de intentos de impresión mediante RPC.
- Ruta permanente `/q/CMV-XXXXXX` que resuelve el destino después del login.

Consulta `docs/PHASE-4-LABELS.md` para el alcance y criterios de aceptación.

### Fase 5 — iPhone, cámara y fotografías
- Escáner QR con cámara trasera desde navegador móvil mediante `@zxing/browser`.
- Ingreso manual y cámara resuelven el mismo flujo de etiqueta.
- Captura desde iPhone con `capture="environment"`.
- Selección múltiple de JPG/PNG, máximo 10 MB por archivo.
- Fotografía requerida por defecto con excepción explícita “continuar sin fotografía”.
- Subida al bucket privado `inventory-files`.
- Metadatos trazables en `attachments`.
- Galería de fotografías en la ficha mediante URLs firmadas temporales.
- Posibilidad de agregar fotografías posteriormente desde la ficha.

Consulta `docs/PHASE-5-MOBILE-PHOTOS.md` para alcance, limitaciones y criterios de aceptación.

## ¿Tengo que configurar algo ahora?

**No, si solo queremos seguir construyendo por fases.**

Antes de imprimir etiquetas físicas definitivas sí debemos disponer de una URL pública estable de la aplicación, porque esa dirección queda codificada dentro del QR.

## Preparación para una prueba real

1. Instalar Node.js 20+.
2. Ejecutar:

```bash
npm install
```

3. Copiar `.env.example` a `.env`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_PUBLIC_APP_URL=https://URL-PUBLICA-ESTABLE
```

4. En Supabase SQL Editor ejecutar una sola vez y en este orden:

```text
supabase/phase1.sql
supabase/phase2.sql
supabase/phase4.sql
```

5. Ejecutar opcionalmente:

```text
supabase/phase2-checks.sql
supabase/phase4-checks.sql
supabase/phase5-checks.sql
```

6. Crear usuarios en Supabase Authentication. No habilitar registro público.
7. Asignar roles:

```sql
update public.profiles
set role = 'superadmin', full_name = 'Pablo Novoa'
where email = 'TU_CORREO';

update public.profiles
set role = 'inventory_admin', full_name = 'Rodrigo Novoa'
where email = 'CORREO_DE_RODRIGO';
```

8. Ejecutar:

```bash
npm run dev
```

## Primer flujo de prueba

1. Crear una categoría y una dependencia en **Configuración**.
2. Ir a **Etiquetas**.
3. Generar una tanda pequeña, por ejemplo 5 etiquetas.
4. Confirmar que el inventario sigue en 0 bienes.
5. Abrir **Imprimir disponibles** y comprobar los QR/códigos.
6. Registrar un bien usando una de esas etiquetas.
7. Confirmar que esa etiqueta pasa a `Asignada`.
8. Confirmar que ya no aparece en la impresión de tanda.
9. Si se necesita otra copia física de esa etiqueta asignada, usar **Reimprimir** en su fila individual.
10. Desde iPhone, abrir **Escanear**, conceder permiso de cámara y comprobar el mismo QR.
11. Registrar un segundo bien tomando al menos una fotografía y confirmar que aparece en su ficha.

## URL permanente del QR

Cada QR contiene una ruta como:

```text
https://inventario.ejemplo.cl/q/CMV-000001
```

No contiene valor, responsable, factura ni otro dato sensible.

Si el usuario no ha iniciado sesión, vuelve al mismo código después de autenticarse. El sistema resuelve:

- disponible → formulario de alta;
- asignada → ficha del bien;
- anulada → acceso bloqueado.

## Integridad aplicada

- `CMV-000001` nunca puede reutilizarse.
- Generar etiquetas no crea bienes.
- Una etiqueta `assigned` o `voided` no vuelve a `available`.
- Alta + asignación son una sola operación atómica.
- Anular exige motivo.
- Reimprimir no genera otro código.
- Una impresión de tanda no reimprime automáticamente etiquetas ya asignadas.
- Un bien no puede cambiar de código.
- No hay flujo normal de `DELETE`.
- Auditoría e historial se conservan indefinidamente.

## Archivos relevantes

```text
supabase/phase1.sql
supabase/phase2.sql
supabase/phase4.sql
supabase/phase2-checks.sql
supabase/phase4-checks.sql
supabase/phase5-checks.sql
docs/PHASE-2-DATA-MODEL.md
docs/PHASE-3-INVENTORY.md
docs/PHASE-4-LABELS.md
docs/PHASE-5-MOBILE-PHOTOS.md
src/services/inventory/inventoryService.ts
src/services/labels/labelService.ts
src/services/media/mediaService.ts
src/features/inventory/
src/features/labels/
src/features/configuration/
src/types/inventory.ts
```

## Próxima fase

**Fase 6 — movimientos:** traslados entre dependencias, cambio de custodio asociado al traslado, préstamos/devoluciones, salida/retorno de reparación y baja documentada sin borrar historia.

## Uso rápido en varios computadores Windows

Se incorporó `ABRIR_INVENTARIO.bat` para simplificar la ejecución local.

En cada PC autorizado:

1. Descomprimir el proyecto.
2. Copiar el `.env` del PC principal a la raíz del proyecto.
3. Hacer doble clic en `ABRIR_INVENTARIO.bat`.
4. Si Node.js LTS falta, el script abre la descarga oficial.
5. En el primer inicio instala dependencias; después abre Inventario CMV automáticamente.

Para una instalación definitiva multi-PC se recomienda desplegar la aplicación en Netlify y acceder mediante una URL única, evitando mantener copias locales del código en cada computador.
