Set-Location $PSScriptRoot

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# Drag borderless window
Add-Type @"
using System; using System.Runtime.InteropServices;
public class W32 {
    [DllImport("user32.dll")] public static extern bool ReleaseCapture();
    [DllImport("user32.dll")] public static extern int SendMessage(IntPtr h, int m, int w, int l);
}
"@

# ── Kolory ─────────────────────────────────────────────────────────────────────
$BG     = [Drawing.Color]::FromArgb(13,  17,  23)
$CARD   = [Drawing.Color]::FromArgb(22,  30,  46)
$BORDER = [Drawing.Color]::FromArgb(51,  65,  85)
$BLUE   = [Drawing.Color]::FromArgb(59,  130, 246)
$GREEN  = [Drawing.Color]::FromArgb(34,  197, 94)
$RED    = [Drawing.Color]::FromArgb(239, 68,  68)
$TEXT   = [Drawing.Color]::FromArgb(241, 245, 249)
$MUTED  = [Drawing.Color]::FromArgb(100, 116, 139)
$WHITE  = [Drawing.Color]::White

# ── Form ───────────────────────────────────────────────────────────────────────
$W = 480; $H = 320
$form                 = New-Object Windows.Forms.Form
$form.FormBorderStyle = 'None'
$form.Size            = New-Object Drawing.Size($W, $H)
$form.StartPosition   = 'CenterScreen'
$form.BackColor       = $BG
$form.TopMost         = $true

# Obramowanie 1px
$form.Add_Paint({
    $pen = New-Object Drawing.Pen($BORDER, 1)
    $_.Graphics.DrawRectangle($pen, 0, 0, $W - 1, $H - 1)
    $pen.Dispose()
})

# Przeciąganie okna myszką
$form.Add_MouseDown({
    [W32]::ReleaseCapture()
    [W32]::SendMessage($form.Handle, 0xA1, 0x2, 0)
})

# ── Header ─────────────────────────────────────────────────────────────────────
$header           = New-Object Windows.Forms.Panel
$header.Size      = New-Object Drawing.Size($W, 110)
$header.Location  = New-Object Drawing.Point(0, 0)
$header.BackColor = $CARD
$header.Add_MouseDown({ [W32]::ReleaseCapture(); [W32]::SendMessage($form.Handle, 0xA1, 0x2, 0) })
$form.Controls.Add($header)

$lbIcon           = New-Object Windows.Forms.Label
$lbIcon.Text      = [char]0x25B6   # ▶
$lbIcon.Font      = New-Object Drawing.Font("Segoe UI", 26, [Drawing.FontStyle]::Bold)
$lbIcon.ForeColor = $BLUE
$lbIcon.AutoSize  = $true
$lbIcon.Location  = New-Object Drawing.Point(28, 18)
$header.Controls.Add($lbIcon)

$lbTitle          = New-Object Windows.Forms.Label
$lbTitle.Text     = "Panel Test Runner"
$lbTitle.Font     = New-Object Drawing.Font("Segoe UI", 17, [Drawing.FontStyle]::Bold)
$lbTitle.ForeColor = $WHITE
$lbTitle.AutoSize  = $true
$lbTitle.Location  = New-Object Drawing.Point(72, 20)
$header.Controls.Add($lbTitle)

$lbSub            = New-Object Windows.Forms.Label
$lbSub.Text       = "Playwright  ·  PHP  ·  React"
$lbSub.Font       = New-Object Drawing.Font("Segoe UI", 9)
$lbSub.ForeColor  = $MUTED
$lbSub.AutoSize   = $true
$lbSub.Location   = New-Object Drawing.Point(74, 60)
$header.Controls.Add($lbSub)

# Separator pod headerem
$sep           = New-Object Windows.Forms.Panel
$sep.Size      = New-Object Drawing.Size($W, 1)
$sep.Location  = New-Object Drawing.Point(0, 110)
$sep.BackColor = $BORDER
$form.Controls.Add($sep)

# ── Kroki (4 etykiety) ─────────────────────────────────────────────────────────
$steps = @(
    "Sprawdzanie Docker",
    "Pobieranie aktualizacji",
    "Uruchamianie kontenera",
    "Aplikacja gotowa"
)
$stepLabels = @()
for ($i = 0; $i -lt 4; $i++) {
    $lb           = New-Object Windows.Forms.Label
    $lb.Text      = "   $($steps[$i])"
    $lb.Font      = New-Object Drawing.Font("Segoe UI", 10)
    $lb.ForeColor = $MUTED
    $lb.Size      = New-Object Drawing.Size(430, 26)
    $lb.Location  = New-Object Drawing.Point(24, 122 + $i * 30)
    $form.Controls.Add($lb)
    $stepLabels += $lb
}

# ── Pasek postępu ──────────────────────────────────────────────────────────────
$pbTrack           = New-Object Windows.Forms.Panel
$pbTrack.Size      = New-Object Drawing.Size(432, 6)
$pbTrack.Location  = New-Object Drawing.Point(24, 248)
$pbTrack.BackColor = $BORDER
$form.Controls.Add($pbTrack)

$pbFill            = New-Object Windows.Forms.Panel
$pbFill.Size       = New-Object Drawing.Size(0, 6)
$pbFill.Location   = New-Object Drawing.Point(0, 0)
$pbFill.BackColor  = $BLUE
$pbTrack.Controls.Add($pbFill)

# ── Status tekst ───────────────────────────────────────────────────────────────
$lbStatus           = New-Object Windows.Forms.Label
$lbStatus.Text      = "Inicjalizacja..."
$lbStatus.Font      = New-Object Drawing.Font("Segoe UI", 9)
$lbStatus.ForeColor = $MUTED
$lbStatus.Size      = New-Object Drawing.Size(432, 20)
$lbStatus.Location  = New-Object Drawing.Point(24, 260)
$form.Controls.Add($lbStatus)

# ── Przyciski (ukryte na start) ────────────────────────────────────────────────
$btnOpen               = New-Object Windows.Forms.Button
$btnOpen.Text          = "Otwórz aplikację"
$btnOpen.Size          = New-Object Drawing.Size(190, 36)
$btnOpen.Location      = New-Object Drawing.Point(24, 274)
$btnOpen.Font          = New-Object Drawing.Font("Segoe UI", 9, [Drawing.FontStyle]::Bold)
$btnOpen.BackColor     = $BLUE
$btnOpen.ForeColor     = $WHITE
$btnOpen.FlatStyle     = 'Flat'
$btnOpen.FlatAppearance.BorderSize = 0
$btnOpen.Visible       = $false
$btnOpen.Cursor        = [Windows.Forms.Cursors]::Hand
$btnOpen.Add_Click({ Start-Process "http://localhost:8080" })
$form.Controls.Add($btnOpen)

$btnStop               = New-Object Windows.Forms.Button
$btnStop.Text          = "Zatrzymaj"
$btnStop.Size          = New-Object Drawing.Size(130, 36)
$btnStop.Location      = New-Object Drawing.Point(226, 274)
$btnStop.Font          = New-Object Drawing.Font("Segoe UI", 9)
$btnStop.BackColor     = [Drawing.Color]::FromArgb(30, 41, 59)
$btnStop.ForeColor     = $MUTED
$btnStop.FlatStyle     = 'Flat'
$btnStop.FlatAppearance.BorderSize = 1
$btnStop.FlatAppearance.BorderColor = $BORDER
$btnStop.Visible       = $false
$btnStop.Cursor        = [Windows.Forms.Cursors]::Hand
$btnStop.Add_Click({
    $lbStatus.Text      = "Zatrzymywanie..."
    $btnStop.Enabled    = $false
    $form.Refresh()
    docker-compose down 2>&1 | Out-Null
    $form.Close()
})
$form.Controls.Add($btnStop)

# ── Pomocnicze ─────────────────────────────────────────────────────────────────
function DoEvents { [Windows.Forms.Application]::DoEvents() }

function Set-Progress($pct, $status, $stepIdx = -1, $done = $false) {
    $pbFill.Width   = [int](432 * $pct / 100)
    $pbFill.BackColor = if ($done) { $GREEN } else { $BLUE }
    $lbStatus.Text  = $status
    if ($stepIdx -ge 0) {
        for ($i = 0; $i -lt 4; $i++) {
            if ($i -lt $stepIdx) {
                $stepLabels[$i].ForeColor = $GREEN
                $stepLabels[$i].Text = [char]0x2713 + "  $($steps[$i])"
            } elseif ($i -eq $stepIdx) {
                $stepLabels[$i].ForeColor = $WHITE
                $stepLabels[$i].Text = "  > $($steps[$i])"
            } else {
                $stepLabels[$i].ForeColor = $MUTED
                $stepLabels[$i].Text = "   $($steps[$i])"
            }
        }
    }
    $form.Refresh(); DoEvents
}

# ── Start ──────────────────────────────────────────────────────────────────────
$form.Show(); DoEvents

# Krok 1: Docker
Set-Progress 5 "Sprawdzanie Docker..." 0

docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Set-Progress 8 "Uruchamianie Docker Desktop..." 0
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
    $w = 0
    while ($w -lt 120) {
        Start-Sleep -Seconds 3; $w += 3
        docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
        Set-Progress ([math]::Min(8 + $w / 2, 24)) "Czekam na Docker... ($w s)" 0
    }
}
Set-Progress 28 "Docker gotowy" 1
Start-Sleep -Milliseconds 300

# Krok 2: git pull
Set-Progress 35 "Pobieranie aktualizacji..." 1
git pull --quiet 2>&1 | Out-Null
Set-Progress 50 "Pobrano aktualizacje" 2
Start-Sleep -Milliseconds 300

# Krok 3: docker-compose up
Set-Progress 58 "Uruchamianie kontenera..." 2
docker-compose up -d 2>&1 | Out-Null
Set-Progress 75 "Kontener uruchomiony" 3
Start-Sleep -Milliseconds 300

# Krok 4: health check
Set-Progress 80 "Czekam az aplikacja bedzie gotowa..." 3
$w = 0
while ($w -lt 90) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8080/api/tests" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { break }
    } catch {}
    Start-Sleep -Seconds 2; $w += 2
    Set-Progress ([math]::Min(80 + $w, 98)) "Czekam... ($w s)" 3
}

# Gotowe
for ($i = 0; $i -lt 4; $i++) {
    $stepLabels[$i].ForeColor = $GREEN
    $stepLabels[$i].Text = [char]0x2713 + "  $($steps[$i])"
}
$pbFill.Width    = 432
$pbFill.BackColor = $GREEN
$lbStatus.Text   = "Aplikacja dziala na localhost:8080"
$lbStatus.ForeColor = $GREEN
$btnOpen.Visible = $true
$btnStop.Visible = $true
$form.Refresh(); DoEvents

Start-Process "http://localhost:8080"

[Windows.Forms.Application]::Run($form)
