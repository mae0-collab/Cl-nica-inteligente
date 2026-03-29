#!/bin/bash
# Para o servidor
cd /home/user/webapp
echo "Parando Clínica Inteligente..."
pm2 delete clinica-inteligente 2>/dev/null || true
kill $(lsof -ti:3000) 2>/dev/null || true
echo "✓ Servidor parado."
pm2 status
