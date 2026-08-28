@echo off
echo ====================================
echo  Auto Push to GitHub & Vercel Deploy
echo ====================================

set /p msg="Masukkan pesan commit (kosongkan untuk default 'update'): "
if "%msg%"=="" set msg=update project

git add .
git commit -m "%msg%"
git push origin main

echo ====================================
echo  Selesai! Vercel akan otomatis deploy.
echo ====================================
pause
