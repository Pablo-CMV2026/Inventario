# Inventario CMV — Fase 2: modelo de datos e integridad

Esta fase convierte la definición funcional acordada en un modelo de datos real para Supabase/PostgreSQL. Todavía no implementa las pantallas finales de inventario, recorridos ni movimientos.

## Principio rector

**Nada histórico se elimina.**

- Un bien dado de baja conserva su código, ficha e historial.
- Una etiqueta anulada nunca se reutiliza.
- Categorías, dependencias, custodios y archivos se desactivan en vez de borrarse.
- Los movimientos y la auditoría se conservan indefinidamente.

El SQL añade triggers que bloquean `DELETE` sobre las tablas de dominio.

## Entidades principales

```text
profiles
   ├── crea → label_batches
   │             └── contiene → asset_labels
   │                               └── identifica → assets
   │
   └── realiza → asset_movements / verification_sessions

assets
   ├── category
   ├── location
   ├── custodian (opcional)
   ├── acquisition_item → acquisition
   ├── attachments
   ├── asset_movements
   └── verification_items
```

## Diferencia entre estado actual e historia

`assets` guarda el **estado actual** del bien: ubicación, custodio, condición y situación operativa.

`asset_movements` conserva los eventos que explican cómo llegó a ese estado.

`audit_log` registra además correcciones administrativas y cambios de datos.

Esto permite responder rápidamente tanto:

- “¿Dónde está ahora CMV-000087?”
- como “¿Quién cambió este registro, cuándo y qué decía antes?”.

## Etiquetas

Estados:

- `available`: código reservado, todavía sin bien.
- `assigned`: vinculado permanentemente a un bien.
- `voided`: anulado antes de usarse; nunca reutilizable.

La transición es unidireccional. `assigned` y `voided` son estados terminales.

### RPC `create_label_batch`

Genera una tanda contigua de códigos `CMV-000001`, `CMV-000002`, etc. y **no crea bienes**.

La función utiliza un contador transaccional bloqueado por fila para reservar rangos contiguos sin duplicados. Si la transacción falla, el contador también se revierte y no queda un código invisible saltado.

### RPC `register_asset_from_label`

Registra el bien y asigna la etiqueta dentro de una única transacción.

La función bloquea la fila de la etiqueta (`FOR UPDATE`) antes de usarla. Dos dispositivos no pueden completar simultáneamente el alta con el mismo código.

## Adquisiciones

Una adquisición puede contener múltiples bienes.

Ejemplo:

```text
Factura 123
├── Notebook A — $799.000
├── Notebook B — $799.000
├── Mouse A — $15.000
└── Teclado A — $22.000
```

`acquisitions.total_paid_clp` conserva el total documental pagado, con IVA incluido.

`acquisition_items.individual_value_clp` guarda el valor atribuible al bien cuando sea conocido. Si no se conoce, queda `NULL`; nunca se transforma en $0.

## Dependencias

`locations.parent_id` permite jerarquía opcional:

```text
Edificio principal
└── Primer piso
    └── Dirección
```

También puede utilizarse una lista plana si no se necesitan niveles.

Un trigger impide ciclos en la jerarquía.

## Verificaciones físicas

Una sesión de recorrido conserva la dependencia revisada y la cantidad esperada al iniciar.

Cada bien puede quedar como:

- `verified_expected`
- `found_other_location`
- `not_verified`

Durante una sesión abierta se utiliza `pending`. Cerrar un recorrido no implica automáticamente que un bien pase a `not_located` en su ficha.

## Archivos

Bucket privado: `inventory-files`.

Tipos aceptados inicialmente:

- PDF
- JPEG
- PNG

Tamaño máximo configurado: 10 MB por archivo.

No existe política `DELETE` para los objetos del bucket. La metadata se desactiva mediante `attachments.is_active`.

## Roles V1

### Superadmin

- lectura y gestión completa del inventario;
- administración de usuarios mediante Supabase;
- acceso al `audit_log`.

### Administrador de inventario

- lectura del inventario;
- alta y edición operativa;
- categorías, dependencias y custodios;
- adquisiciones;
- verificaciones y archivos.

### Viewer

- lectura solamente.

Las transiciones sensibles del activo se protegerán mediante RPC específicas. Fase 2 ya impide que ubicación, custodio, estado operativo, baja o verificación se cambien como una simple edición libre.

## SQL de instalación

Ejecutar en este orden:

1. `supabase/phase1.sql`
2. `supabase/phase2.sql`

No ejecutar Fase 2 dos veces sobre la misma base sin una migración de rollback/controlada.

## Criterios de aceptación de Fase 2

- [ ] Todas las tablas se crean sin errores después de Fase 1.
- [ ] Un usuario anónimo no puede leer tablas de inventario.
- [ ] Un `viewer` puede consultar, pero no insertar/actualizar.
- [ ] Administrador y Superadmin pueden gestionar tablas operativas.
- [ ] `create_label_batch(20)` crea 20 etiquetas y 0 bienes.
- [ ] Los códigos son únicos y correlativos.
- [ ] Una etiqueta anulada no puede volver a `available`.
- [ ] `register_asset_from_label()` asigna etiqueta + crea bien + registra movimiento inicial de forma atómica.
- [ ] La misma etiqueta no puede registrar dos bienes.
- [ ] Ninguna tabla histórica admite `DELETE` normal.
- [ ] Un bien dado de baja nunca podrá reactivarse cuando se implemente esa transición.
- [ ] Cambiar ubicación/custodio/estado operativo directamente es rechazado; deberá hacerse mediante acción trazable.
- [ ] El valor individual desconocido puede quedar `NULL`.
- [ ] La jerarquía de dependencias no admite ciclos.
- [ ] La auditoría registra altas y modificaciones.
- [ ] El bucket de archivos es privado y acepta solo PDF/JPEG/PNG.

## Lo que NO implementa todavía esta fase

- interfaz real de inventario;
- lector QR;
- impresión visual de etiquetas;
- flujo UI de traslado;
- préstamos;
- reparación;
- baja;
- recorrido físico completo;
- dashboard con datos reales;
- exportaciones.

La base queda preparada para construir esos módulos sin rehacer el modelo.
