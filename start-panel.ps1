Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# ── Colors ───────────────────────────────────────────────────────────────────
$C_BG     = [System.Drawing.Color]::FromArgb(15,  23,  42)
$C_BG2    = [System.Drawing.Color]::FromArgb(30,  41,  59)
$C_BG3    = [System.Drawing.Color]::FromArgb(51,  65,  85)
$C_TEXT   = [System.Drawing.Color]::FromArgb(241, 245, 249)
$C_MUTED  = [System.Drawing.Color]::FromArgb(148, 163, 184)
$C_BLUE   = [System.Drawing.Color]::FromArgb(59,  130, 246)
$C_GREEN  = [System.Drawing.Color]::FromArgb(34,  197, 94)
$C_RED    = [System.Drawing.Color]::FromArgb(239, 68,  68)

# ── Form ─────────────────────────────────────────────────────────────────────
$form                  = New-Object System.Windows.Forms.Form
$form.Text             = "Panel Test Runner"
$form.Size             = New-Object System.Drawing.Size(540, 340)
$form.StartPosition    = "CenterScreen"
$form.FormBorderStyle  = "FixedSingle"
$form.MaximizeBox      = $false
$form.BackColor        = $C_BG

# ── Header bar ───────────────────────────────────────────────────────────────
$header           = New-Object System.Windows.Forms.Panel
$header.Size      = New-Object System.Drawing.Size(540, 100)
$header.Location  = New-Object System.Drawing.Point(0, 0)
$header.BackColor = $C_BG2
$form.Controls.Add($header)

$lbTitle          = New-Object System.Windows.Forms.Label
$lbTitle.Text     = "Panel Test Runner"
$lbTitle.Font     = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$lbTitle.ForeColor = $C_TEXT
$lbTitle.AutoSize = $true
$lbTitle.Location = New-Object System.Drawing.Point(25, 18)
$header.Controls.Add($lbTitle)

$lbSub            = New-Object System.Windows.Forms.Label
$lbSub.Text       = "Playwright  ·  PHP  ·  React"
$lbSub.Font       = New-Object System.Drawing.Font("Segoe UI", 9)
$lbSub.ForeColor  = $C_MUTED
$lbSub.AutoSize   = $true
$lbSub.Location   = New-Object System.Drawing.Point(27, 60)
$header.Controls.Add($lbSub)

# ── Status label ─────────────────────────────────────────────────────────────
$lbStatus          = New-Object System.Windows.Forms.Label
$lbStatus.Text     = "Inicjalizacja..."
$lbStatus.Font     = New-Object System.Drawing.Font("Segoe UI", 10)
$lbStatus.ForeColor = $C_TEXT
$lbStatus.Size     = New-Object System.Drawing.Size(490, 26)
$lbStatus.Location = New-Object System.Drawing.Point(25, 120)
$form.Controls.Add($lbStatus)

# ── Step detail ───────────────────────────────────────────────────────────────
$lbDetail          = New-Object System.Windows.Forms.Label
$lbDetail.Text     = ""
$lbDetail.Font     = New-Object System.Drawing.Font("Segoe UI", 9)
$lbDetail.ForeColor = $C_MUTED
$lbDetail.Size     = New-Object System.Drawing.Size(490, 20)
$lbDetail.Location = New-Object System.Drawing.Point(25, 148)
$form.Controls.Add($lbDetail)

# ── Progress bar ─────────────────────────────────────────────────────────────
$pb               = New-Object System.Windows.Forms.ProgressBar
$pb.Size          = New-Object System.Drawing.Size(490, 10)
$pb.Location      = New-Object System.Drawing.Point(25, 178)
$pb.Style         = "Continuous"
$pb.Maximum       = 100
$pb.Value         = 0
$form.Controls.Add($pb)

# ── Separator ────────────────────────────────────────────────────────────────
$sep              = New-Object System.Windows.Forms.Panel
$sep.Size         = New-Object System.Drawing.Size(490, 1)
$sep.Location     = New-Object System.Drawing.Point(25, 200)
$sep.BackColor    = $C_BG3
$form.Controls.Add($sep)

# ── URL info ──────────────────────────────────────────────────────────────────
$lbUrl            = New-Object System.Windows.Forms.Label
$lbUrl.Text       = "http://localhost:8080"
$lbUrl.Font       = New-Object System.Drawing.Font("Consolas", 9)
$lbUrl.ForeColor  = $C_MUTED
$lbUrl.AutoSize   = $true
$lbUrl.Location   = New-Object System.Drawing.Point(25, 214)
$form.Controls.Add($lbUrl)

$lbVnc            = New-Object System.Windows.Forms.Label
$lbVnc.Text       = "noVNC: http://localhost:7900"
$lbVnc.Font       = New-Object System.Drawing.Font("Consolas", 9)
$lbVnc.ForeColor  = $C_MUTED
$lbVnc.AutoSize   = $true
$lbVnc.Location   = New-Object System.Drawing.Point(280, 214)
$form.Controls.Add($lbVnc)

# ── Stop button (hidden initially) ───────────────────────────────────────────
$btnStop               = New-Object System.Windows.Forms.Button
$btnStop.Text          = "Zatrzymaj aplikacje"
$btnStop.Size          = New-Object System.Drawing.Size(200, 38)
$btnStop.Location      = New-Object System.Drawing.Point(170, 255)
$btnStop.Font          = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnStop.BackColor     = $C_RED
$btnStop.ForeColor     = $C_TEXT
$btnStop.FlatStyle     = "Flat"
$btnStop.FlatAppearance.BorderSize = 0
$btnStop.Visible       = $false
$btnStop.Cursor        = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnStop)

$btnStop.Add_Click({
    $lbStatus.Text     = "Zatrzymywanie kontenera..."
    $lbStatus.ForeColor = $C_MUTED
    $btnStop.Enabled   = $false
    $form.Refresh()
    Push-Location $PSScriptRoot
    & docker-compose down 2>&1 | Out-Null
    Pop-Location
    $form.Close()
})

# ── Helper ────────────────────────────────────────────────────────────────────
function Set-Step($pct, $msg, $detail = "", $color = $null) {
    $pb.Value           = [math]::Min($pct, 100)
    $lbStatus.Text      = $msg
    $lbStatus.ForeColor = if ($color) { $color } else { $C_TEXT }
    $lbDetail.Text      = $detail
    $form.Refresh()
    [System.Windows.Forms.Application]::DoEvents()
}

$form.Show()
$form.Refresh()

# ── Step 1: Docker ───────────────────────────────────────────────────────────
Set-Step 5 "Sprawdzanie Docker..." "Krok 1 / 4"

& docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Set-Step 10 "Uruchamianie Docker Desktop..." "Krok 1 / 4 — moze zajac do 30 sekund"
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
    $w = 0
    while ($w -lt 120) {
        Start-Sleep -Seconds 3; $w += 3
        & docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
        Set-Step ([math]::Min(10 + $w, 28)) "Czekam na Docker Desktop..." "Krok 1 / 4 — $w s"
    }
}

Set-Step 30 "Docker gotowy." "Krok 1 / 4  ✓" $C_GREEN
Start-Sleep -Milliseconds 400

# ── Step 2: git pull ─────────────────────────────────────────────────────────
Set-Step 40 "Pobieranie aktualizacji..." "Krok 2 / 4 — git pull"
Push-Location $PSScriptRoot
& git pull --quiet 2>&1 | Out-Null
Pop-Location

Set-Step 55 "Aktualizacja pobrana." "Krok 2 / 4  ✓" $C_GREEN
Start-Sleep -Milliseconds 300

# ── Step 3: docker-compose up ────────────────────────────────────────────────
Set-Step 65 "Uruchamianie kontenera..." "Krok 3 / 4 — docker-compose up -d"
Push-Location $PSScriptRoot
& docker-compose up -d 2>&1 | Out-Null
Pop-Location

Set-Step 80 "Kontener uruchomiony." "Krok 3 / 4  ✓" $C_GREEN
Start-Sleep -Milliseconds 300

# ── Step 4: health check ─────────────────────────────────────────────────────
Set-Step 85 "Czekam az aplikacja bedzie gotowa..." "Krok 4 / 4"
$w = 0
while ($w -lt 90) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8080/api/tests" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { break }
    } catch {}
    Start-Sleep -Seconds 2; $w += 2
    Set-Step ([math]::Min(85 + $w, 98)) "Czekam az aplikacja bedzie gotowa..." "Krok 4 / 4 — $w s"
}

Set-Step 100 "Aplikacja gotowa!" "" $C_GREEN
Start-Sleep -Milliseconds 500

Start-Process "http://localhost:8080"

# ── Running state ─────────────────────────────────────────────────────────────
$lbStatus.Text      = "Aplikacja dziala!"
$lbStatus.ForeColor = $C_GREEN
$lbDetail.Text      = "Kliknij przycisk ponizej aby zatrzymac."
$lbDetail.ForeColor = $C_MUTED
$lbUrl.ForeColor    = $C_BLUE
$lbVnc.ForeColor    = $C_BLUE
$btnStop.Visible    = $true
$form.Refresh()

[System.Windows.Forms.Application]::Run($form)
