# Configure environment variables for Android SDK and Java JBR
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:PATH;C:\Users\ronno\AppData\Local\Android\Sdk\platform-tools"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Configuring build environment..." -ForegroundColor Cyan
Write-Host "Java JBR Path: $env:JAVA_HOME" -ForegroundColor Gray
Write-Host "=============================================" -ForegroundColor Cyan

# Step 1: Build the React web distribution
Write-Host "Step 1: Building React Web Assets..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "React build failed!"
    exit $LASTEXITCODE
}

# Step 2: Sync Capacitor web assets into the Android folder
Write-Host "Step 2: Syncing Capacitor assets with Android..." -ForegroundColor Yellow
npx cap sync
if ($LASTEXITCODE -ne 0) {
    Write-Error "Capacitor sync failed!"
    exit $LASTEXITCODE
}

# Step 3: Run local Gradle to build the signed .aab
Write-Host "Step 3: Compiling signed .aab locally via Gradle..." -ForegroundColor Yellow
Set-Location android
.\gradlew.bat bundleRelease --stacktrace
if ($LASTEXITCODE -ne 0) {
    Write-Error "Gradle build failed!"
    Set-Location ..
    exit $LASTEXITCODE
}

Set-Location ..

Write-Host "`n=============================================" -ForegroundColor Green
Write-Host "SUCCESS! Your local AAB is ready at:" -ForegroundColor Green
Write-Host "e:\Antigravity\Beeks\Beekeeper\android\app\build\outputs\bundle\release\app-release.aab" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Green
