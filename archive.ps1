$zipName = "nika-bot.zip"
$tempDir = "temp_archive_dir"

Write-Host "--- Build and Archive (Strict Deployment) ---" -ForegroundColor Cyan

# 1. Компиляция
Write-Host "Compiling..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

# 2. Подготовка временной папки
if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir | Out-Null

Write-Host "Copying deployment files..." -ForegroundColor Yellow

# Копируем dist (папку целиком, так как запуск теперь через node dist/index.js)
if (Test-Path "dist") {
    Copy-Item -Path "dist" -Destination $tempDir -Recurse -Force
    # Удаляем мусор
    Get-ChildItem -Path "$tempDir/dist" -Include *.d.ts, *.js.map -Recurse | Remove-Item -Force
}

# Копируем конфиги и ассеты
$rootFiles = @("package.json", "package-lock.json", ".env", "assets")
foreach ($f in $rootFiles) {
    if (Test-Path $f) {
        Copy-Item -Path $f -Destination $tempDir -Recurse -Force
    }
}

# Копируем папку prisma ЦЕЛИКОМ
if (Test-Path "prisma") {
    Copy-Item -Path "prisma" -Destination $tempDir -Recurse -Force
    # На всякий случай удаляем файл БД внутри скопированной папки, чтобы не тащить лишний вес
    if (Test-Path "$tempDir/prisma/dev.db") {
        Remove-Item "$tempDir/prisma/dev.db" -Force
    }
}

# 3. Создаем архив
Write-Host "Creating archive $zipName..." -ForegroundColor Yellow
if (Test-Path $zipName) { Remove-Item $zipName }

$currentDir = Get-Location
Set-Location $tempDir
# Архивируем содержимое tempDir (не саму папку)
Compress-Archive -Path * -DestinationPath "..\\$zipName" -Force
Set-Location $currentDir

# 4. Очистка
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "SUCCESS! Archive is ready for server deployment." -ForegroundColor Green
