# Inventario CMV — Fase 5: iPhone, cámara QR y fotografías

## Objetivo

Completar el flujo móvil real de levantamiento físico:

1. abrir la aplicación desde iPhone;
2. activar la cámara trasera y leer un QR CMV;
3. resolver una etiqueta disponible o asignada con el mismo flujo ya existente;
4. capturar fotografías durante el alta;
5. guardar las fotografías en el bucket privado de Supabase;
6. consultar y completar fotografías desde la ficha del bien.

## Escáner QR

Se incorpora `@zxing/browser` para lectura continua mediante `getUserMedia`.

El escáner acepta:

- un QR cuya carga sea directamente `CMV-000001`;
- la URL estable de la aplicación, por ejemplo `https://inventario.../q/CMV-000001`.

Al detectar el código se detiene la cámara y se reutiliza exactamente la misma lógica del ingreso manual:

- etiqueta disponible → alta de bien;
- etiqueta asignada → ficha existente;
- etiqueta anulada → bloqueo.

### Requisitos del navegador

La cámara requiere contexto seguro:

- producción: HTTPS;
- desarrollo local: `localhost`.

En iPhone se debe conceder permiso de cámara a Safari o al navegador utilizado. Si la cámara no está disponible, el ingreso manual permanece siempre accesible.

## Fotografías

Durante el alta, la fotografía es requerida por defecto, pero no es un bloqueo absoluto. El usuario puede marcar explícitamente:

> Continuar sin fotografía y dejarla pendiente para completar después.

Se permiten hasta cinco fotografías por selección y los formatos de V1 son:

- JPG/JPEG;
- PNG;
- máximo 10 MB por archivo.

En iPhone el botón **Tomar foto** utiliza `capture="environment"` para solicitar la cámara trasera. También existe **Elegir foto**.

## Orden de guardado

La trazabilidad del bien tiene prioridad. El flujo es:

1. `register_asset_from_label()` crea el bien y asigna la etiqueta atómicamente;
2. después se suben las fotografías;
3. cada archivo se almacena en `inventory-files`;
4. se crea su metadato en `attachments` asociado al bien.

Si una fotografía falla después de crear el bien, el activo NO se vuelve a registrar ni se revierte la etiqueta. La ficha queda válida y la fotografía se muestra como pendiente para completarla después.

## Storage privado

Fase 5 reutiliza la infraestructura creada en `phase2.sql`:

- bucket `inventory-files` privado;
- usuarios activos pueden leer;
- gestores de inventario pueden subir;
- no existe política normal de DELETE;
- las fotografías se muestran mediante URLs firmadas temporales.

No se agrega `phase5.sql` porque no se requieren cambios de esquema. Se incluye `phase5-checks.sql` para verificar que la infraestructura necesaria existe.

## Criterios de aceptación

- El iPhone puede solicitar cámara y detectar un QR CMV desde una URL HTTPS.
- Leer un QR y escribir el mismo código manualmente producen el mismo resultado funcional.
- Un QR ajeno a Inventario CMV no abre un bien.
- La cámara puede detenerse explícitamente y se libera al salir de la pantalla.
- En el alta se puede tomar o seleccionar una fotografía JPG/PNG.
- No se acepta un archivo superior a 10 MB.
- Sin fotografía, el usuario debe confirmar expresamente que desea continuar dejándola pendiente.
- El bien se registra una sola vez aunque falle posteriormente la subida de una fotografía.
- Las fotografías quedan en Storage privado y sus metadatos en `attachments`.
- Una ficha existente muestra sus fotografías mediante URLs firmadas.
- Desde la ficha se pueden agregar fotografías posteriormente.
- No se incorporó borrado físico de fotografías.
