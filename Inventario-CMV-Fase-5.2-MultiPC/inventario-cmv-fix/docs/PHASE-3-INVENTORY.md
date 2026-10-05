# Inventario CMV — Fase 3: inventario básico

## Objetivo

Conectar la interfaz de Inventario CMV al modelo real de Supabase definido en Fase 2 y permitir el primer flujo funcional de consulta y alta de bienes.

## Funcionalidad incorporada

### Dashboard conectado
- Total de bienes inventariados.
- Activos.
- Pendientes de primera verificación física.
- En reparación.
- Dados de baja.
- Etiquetas disponibles.
- Distribución por categoría.

### Configuración mínima
La aplicación permite crear y consultar:
- categorías;
- dependencias, con dependencia superior opcional;
- responsables/custodios.

Los registros no se eliminan. Se pueden desactivar y reactivar, conservando historia.

### Inventario
- listado conectado a `v_assets_current`;
- búsqueda por código, nombre, marca, modelo, serie, responsable, dependencia y categoría;
- filtros por categoría, dependencia y ciclo de vida;
- acceso a ficha individual.

### Alta de bien
El alta utiliza la RPC `register_asset_from_label()` de Fase 2.

Flujo:
1. Ingresar una etiqueta CMV existente.
2. Validar su estado.
3. Si está disponible, completar los datos mínimos.
4. Confirmar.
5. La base crea el bien y asigna la etiqueta en la misma transacción.
6. La aplicación abre la ficha creada.

Una etiqueta asignada o anulada no puede utilizarse para crear otro bien.

### Acceso manual por código
`/escanear` ya permite escribir un código manualmente:
- etiqueta disponible → abre el registro de nuevo bien;
- etiqueta asignada → abre la ficha existente;
- etiqueta anulada → informa que no puede reutilizarse.

La cámara QR se implementará en una fase posterior utilizando este mismo flujo.

### Ficha del bien
Muestra:
- código y nombre;
- categoría;
- condición física;
- situación operativa;
- ciclo de vida;
- ubicación y responsable;
- marca, modelo y serie;
- origen/propiedad;
- información de adquisición disponible;
- fechas principales;
- historial de movimientos.

## Lo que todavía NO incluye Fase 3

- generación e impresión completa de tandas desde la interfaz;
- lectura QR con cámara;
- fotografías desde iPhone;
- traslados;
- préstamos;
- reparaciones;
- bajas;
- recorridos/verificaciones;
- adquisiciones desde la interfaz;
- exportaciones.

## Preparación necesaria para pruebas reales

No es obligatorio configurar Supabase para seguir desarrollando las siguientes fases. Antes de una prueba real sí será necesario:

1. Crear el proyecto Supabase.
2. Ejecutar `phase1.sql` y después `phase2.sql`.
3. Crear las cuentas autorizadas y asignar roles.
4. Configurar `.env` con URL y anon key.
5. Disponer de al menos una categoría, dependencia y etiqueta disponible.

La interfaz de Fase 3 permite crear categorías, dependencias y responsables. La gestión completa de tandas de etiquetas corresponde a Fase 4.

## Criterios de aceptación

- Un usuario autenticado puede consultar el inventario real.
- La búsqueda no altera datos.
- Una etiqueta disponible puede utilizarse para registrar exactamente un bien.
- Una etiqueta asignada no puede crear un segundo bien.
- El registro nuevo aparece inmediatamente en la ficha y en el inventario al recargar.
- La ficha usa el estado actual de `v_assets_current` y el historial append-only de `asset_movements`.
- Categorías, dependencias y responsables pueden agregarse sin modificar código.
- Desactivar configuración no elimina sus registros históricos.
