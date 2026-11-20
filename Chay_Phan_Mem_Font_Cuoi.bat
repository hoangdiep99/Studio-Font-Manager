@echo off
title Phan Mem Quan Ly & Xem Truoc Font Chu Anh Cuoi (Dau - Re)
cd /d "%~dp0"
echo Dang khoi dong Phan mem Quan ly Font Chu Anh Cuoi...
start "" "http://localhost:3456"
node server.js
pause
