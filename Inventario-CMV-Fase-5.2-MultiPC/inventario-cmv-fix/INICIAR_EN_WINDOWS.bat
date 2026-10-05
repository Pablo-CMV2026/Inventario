@echo off
setlocal
cd /d "%~dp0"
title Inventario CMV - Servidor local

echo ==========================================
echo        INVENTARIO CMV - INICIO LOCAL
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js en este computador.
  echo Instala Node.js LTS desde https://nodejs.org/ y vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Primera ejecucion: instalando dependencias...
  echo Esto puede tardar unos minutos y requiere Internet.
  call npm install
  if errorlevel 1 (
    echo.
    echo No fue posible instalar las dependencias.
    pause
    exit /b 1
  )
)

echo.
echo Abriendo Inventario CMV en http://localhost:5173
start "" http://localhost:5173
call npm run dev -- --host 127.0.0.1
