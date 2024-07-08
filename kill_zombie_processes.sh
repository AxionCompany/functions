#!/bin/bash

# Loop through the port range 3000 to 3050
for port in {3500..3550}; do
  # Find the process ID (PID) using the port
  pid=$(lsof -t -i tcp:$port)
  
  # If a process is found, kill it
  if [ ! -z "$pid" ]; then
    echo "Killing process $pid on port $port"
    kill -9 $pid
  else
    echo "No process found on port $port"
  fi
done

echo "Done."