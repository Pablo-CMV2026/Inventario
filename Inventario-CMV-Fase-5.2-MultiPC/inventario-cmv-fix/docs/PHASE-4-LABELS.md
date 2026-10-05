# Inventario CMV — Fase 4: etiquetas

## Objetivo

Completar el ciclo de identificación física antes de integrar la cámara del iPhone:

1. generar una tanda de códigos correlativos;
2. revisar sus estados;
3. imprimir QR + código CMV en formato compacto;
4. anular de forma permanente una etiqueta disponible cuando corresponda;
5. reimprimir una etiqueta sin crear un nuevo código ni un nuevo bien.

## Principios conservados

- Generar etiquetas **no crea bienes**.
- Un código asignado nunca vuelve a disponible.
- Un código anulado nunca vuelve a utilizarse.
- La reimpresión conserva exactamente el mismo código y destino QR.
- El QR no contiene datos del bien; contiene una ruta estable de la aplicación.
- El sistema registra intentos de impresión, no puede certificar que una impresora física terminó el trabajo.

## URL permanente del QR

Antes de imprimir etiquetas definitivas debe configurarse:

```env
VITE_PUBLIC_APP_URL=https://inventario.ejemplo.cl
```

Cada QR se construye como:

```text
VITE_PUBLIC_APP_URL/q/CMV-000001
```

Si el usuario no está autenticado, la aplicación lo envía al login y después vuelve al mismo código. Una etiqueta disponible abre el formulario de alta; una asignada abre la ficha del bien; una anulada queda bloqueada.

Si `VITE_PUBLIC_APP_URL` no existe, durante desarrollo se utiliza `window.location.origin`. Eso es útil para pruebas, pero no debe utilizarse para imprimir las etiquetas físicas definitivas.

## Formato físico inicial

La hoja usa etiquetas de **50 × 30 mm** con:

- QR;
- código legible `CMV-XXXXXX`.

No se agrega escudo ni información variable. El formato está pensado para impresora convencional y corte/adhesión inicial. Más adelante puede adaptarse a una impresora térmica sin cambiar el código patrimonial ni el contenido del QR.

## SQL de esta fase

Ejecutar después de `phase2.sql`:

```text
supabase/phase4.sql
```

Agrega dos RPC:

- `record_label_print(uuid)`
- `record_label_batch_print(uuid)`

Los contadores se actualizan desde la base de datos. El cliente deja de tener permiso de escritura directa sobre los metadatos de impresión de `asset_labels`.

## Criterios de aceptación

- Crear una tanda de 20 genera exactamente 20 etiquetas y 0 bienes.
- Los códigos son consecutivos y no se duplican.
- Una tanda muestra disponibles, asignadas y anuladas.
- La impresión de tanda incluye solamente etiquetas disponibles.
- Las etiquetas asignadas se reimprimen de manera individual para evitar duplicados físicos accidentales.
- Las etiquetas anuladas nunca se imprimen.
- Imprimir una tanda registra un intento de impresión de tanda y de sus etiquetas disponibles.
- Reimprimir una etiqueta no cambia su código, estado ni relación con el bien.
- Anular exige motivo y solo funciona mientras la etiqueta está disponible.
- Una etiqueta anulada no puede imprimirse desde la interfaz.
- El QR abre `/q/CMV-XXXXXX` y resuelve el estado del código después de autenticarse.
