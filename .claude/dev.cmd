@echo off
set "PATH=C:\Program Files\nodejs;C:\Users\antho\AppData\Roaming\npm;%PATH%"
call pnpm dev --port 3022 --hostname 127.0.0.1
