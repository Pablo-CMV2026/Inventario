@echo off
setlocal
cd /d "%~dp0"
title Inventario CMV

if not exist ".env" (
  echo.
  echo ==============================================
  echo INVENTARIO CMV - FALTA CONFIGURACION
  echo ==============================================
  echo.
  echo No existe el archivo .env en esta carpeta.
  echo Copia el archivo .env desde el PC principal a esta misma carpeta.
  echo.
  echo El .env de Inventario CMV debe contener solo:
  echo - VITE_SUPABASE_URL
  echo - VITE_SUPABASE_ANON_KEY
  echo - VITE_PUBLIC_APP_URL
  echo.
  echo NO copies ni guardes una service_role key aqui.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ==============================================
  echo INVENTARIO CMV - NODE.JS NO INSTALADO
  echo ==============================================
  echo.
  echo Este computador necesita Node.js LTS una sola vez.
  echo Se abrira la pagina oficial de descarga.
  echo Instala Node.js LTS, cierra esta ventana y luego
  echo vuelve a hacer doble clic en ABRIR_INVENTARIO.bat.
  echo.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo Primera ejecucion en este computador.
  echo Instalando componentes de Inventario CMV...
  echo Esto se realiza una sola vez y requiere Internet.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo ERROR: no fue posible instalar los componentes.
    echo Verifica la conexion a Internet e intentalo nuevamente.
    pause
    exit /b 1
  )
)

echo.
echo ==============================================
echo        INVENTARIO CMV - INICIANDO
 echo ==============================================
echo.
echo No cierres esta ventana mientras uses Inventario CMV.
echo El navegador se abrira automaticamente.
echo.

start "" "http://localhost:5173"
call npm run dev -- --host 127.0.0.1
