cp -f landmarks.json places.json

pid=$(netstat -ano 2>/dev/null | awk '/:3000/ && /LISTENING/ {print $5; exit}')

if [ -n "$pid" ]; then
    taskkill //F //PID "$pid"
fi

npm start


