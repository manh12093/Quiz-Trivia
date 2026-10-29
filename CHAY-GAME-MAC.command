#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then echo "Ban chua cai Node.js. Tai ban LTS tai https://nodejs.org roi chay lai."; open https://nodejs.org; exit; fi
node server.js &
sleep 2; open http://localhost:3000
echo "Cho vai giay, tim dong co 'trycloudflare.com' ben duoi va gui link do cho thi sinh."
npx --yes cloudflared tunnel --url http://localhost:3000
