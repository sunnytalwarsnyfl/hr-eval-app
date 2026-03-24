#!/bin/bash
# Start both backend and frontend dev servers

echo "Starting HR Eval App..."
echo ""

# Start backend
echo "Starting backend on http://localhost:3001"
cd "$(dirname "$0")/backend" && npm start &
BACKEND_PID=$!

sleep 2

# Start frontend
echo "Starting frontend on http://localhost:5173"
cd "$(dirname "$0")/frontend" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "App running:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop"
wait
