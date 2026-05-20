#!/bin/sh
echo "[+] Limpiando sesion anterior..."
rm -rf /app/auth_info_baileys/*
rm -rf /app/auth_info_baileys/.w* 2>/dev/null

echo "[+] Iniciando bot..."
exec node index.js
