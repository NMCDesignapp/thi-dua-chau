@echo off
chcp 65001 >nul
echo ============================================
echo   CAP NHAT CODE THI DUA THUONG LEN GITHUB
echo ============================================
echo.

REM Kiem tra git
git --version >nul 2>&1
if errorlevel 1 (
    echo LOI: Chua cai dat Git!
    echo Vao https://git-scm.com/download/win tai va cai dat Git
    pause
    exit /b
)

REM Kiem tra thu muc
if not exist "src\app\api\setup\route.ts" (
    echo LOI: Hay dat file .bat nay cung thu muc voi cac file da giai nen tu ZIP!
    echo (Cung thu muc voi thu muc src, prisma, public...)
    pause
    exit /b
)

echo Dang cap nhat code len GitHub...
echo.

git add -A
git commit -m "Cap nhat Neon Postgres"
git push

echo.
if errorlevel 1 (
    echo.
    echo LOI: Khong the push len GitHub!
    echo Ban can dang nhap Git truoc. Chay lenh sau:
    echo   git config --global user.email "email-cua-ban@gmail.com"
    echo   git config --global user.name "Ten cua ban"
    echo   git push
    echo.
) else (
    echo ============================================
    echo   THANH CONG! Code da duoc push len GitHub!
    echo   Vercel se tu dong deploy trong 1-2 phut.
    echo ============================================
    echo.
    echo Sau khi deploy xong, mo trinh duyet va vao:
    echo   https://ten-project-cua-ban.vercel.app/api/setup
    echo de tao bang database (chi can lam 1 lan).
)

pause
