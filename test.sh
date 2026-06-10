cp -f users.bak users.json
cp -f places.bak places.json
npm start

#	taskkill //F //PID $(netstat -ano | awk '/:3000 / && /LISTENING/ {print $5; exit}')

