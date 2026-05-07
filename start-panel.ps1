Set-Location $PSScriptRoot

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

Add-Type @"
using System; using System.Runtime.InteropServices;
public class W32 {
    [DllImport("user32.dll")] public static extern bool ReleaseCapture();
    [DllImport("user32.dll")] public static extern int SendMessage(IntPtr h, int m, int w, int l);
}
"@

# Colors
$BG     = [Drawing.Color]::FromArgb(13,  17,  23)
$CARD   = [Drawing.Color]::FromArgb(22,  30,  46)
$BORDER = [Drawing.Color]::FromArgb(51,  65,  85)
$BLUE   = [Drawing.Color]::FromArgb(59,  130, 246)
$GREEN  = [Drawing.Color]::FromArgb(34,  197, 94)
$TEXT   = [Drawing.Color]::FromArgb(241, 245, 249)
$MUTED  = [Drawing.Color]::FromArgb(100, 116, 139)
$WHITE  = [Drawing.Color]::White

$W = 460; $H = 280

$form                 = New-Object Windows.Forms.Form
$form.FormBorderStyle = 'None'
$form.Size            = New-Object Drawing.Size($W, $H)
$form.StartPosition   = 'CenterScreen'
$form.BackColor       = $BG
$form.TopMost         = $true

# Ikona z systemu
try {
    Add-Type @"
using System; using System.Runtime.InteropServices; using System.Drawing;
public class IconEx {
    [DllImport("shell32.dll")]
    public static extern IntPtr ExtractIcon(IntPtr h, string f, int i);
    public static Icon Get(int i) { return Icon.FromHandle(ExtractIcon(IntPtr.Zero, Environment.SystemDirectory + "\\shell32.dll", i)); }
}
"@
    $form.Icon = [IconEx]::Get(14)
} catch {}

# Obramowanie
$form.Add_Paint({
    $p = New-Object Drawing.Pen($BORDER, 1)
    $_.Graphics.DrawRectangle($p, 0, 0, $W-1, $H-1)
    $p.Dispose()
})

# Przeciaganie
$drag = { [W32]::ReleaseCapture(); [W32]::SendMessage($form.Handle, 0xA1, 0x2, 0) }
$form.Add_MouseDown($drag)

# Header
$header           = New-Object Windows.Forms.Panel
$header.Size      = New-Object Drawing.Size($W, 90)
$header.Location  = New-Object Drawing.Point(0, 0)
$header.BackColor = $CARD
$header.Add_MouseDown($drag)
$form.Controls.Add($header)

$lbTitle          = New-Object Windows.Forms.Label
$lbTitle.Text     = "Panel Test Runner"
$lbTitle.Font     = New-Object Drawing.Font("Segoe UI", 16, [Drawing.FontStyle]::Bold)
$lbTitle.ForeColor = $WHITE
$lbTitle.AutoSize  = $true
$lbTitle.Location  = New-Object Drawing.Point(22, 16)
$header.Controls.Add($lbTitle)

$lbSub            = New-Object Windows.Forms.Label
$lbSub.Text       = "Playwright  |  PHP  |  React"
$lbSub.Font       = New-Object Drawing.Font("Segoe UI", 9)
$lbSub.ForeColor  = $MUTED
$lbSub.AutoSize   = $true
$lbSub.Location   = New-Object Drawing.Point(24, 52)
$header.Controls.Add($lbSub)

$sep           = New-Object Windows.Forms.Panel
$sep.Size      = New-Object Drawing.Size($W, 1)
$sep.Location  = New-Object Drawing.Point(0, 90)
$sep.BackColor = $BORDER
$form.Controls.Add($sep)

# Kroki
$steps = @("Sprawdzanie Docker", "Pobieranie aktualizacji", "Budowanie i uruchamianie", "Aplikacja gotowa")
$stepLabels = @()
for ($i = 0; $i -lt 4; $i++) {
    $lb            = New-Object Windows.Forms.Label
    $lb.Text       = "   $($steps[$i])"
    $lb.Font       = New-Object Drawing.Font("Segoe UI", 10)
    $lb.ForeColor  = $MUTED
    $lb.Size       = New-Object Drawing.Size(420, 26)
    $lb.Location   = New-Object Drawing.Point(20, 100 + $i * 28)
    $form.Controls.Add($lb)
    $stepLabels += $lb
}

# Pasek postepu
$pbTrack          = New-Object Windows.Forms.Panel
$pbTrack.Size     = New-Object Drawing.Size(420, 5)
$pbTrack.Location = New-Object Drawing.Point(20, 218)
$pbTrack.BackColor = $BORDER
$form.Controls.Add($pbTrack)

$pbFill           = New-Object Windows.Forms.Panel
$pbFill.Size      = New-Object Drawing.Size(0, 5)
$pbFill.Location  = New-Object Drawing.Point(0, 0)
$pbFill.BackColor = $BLUE
$pbTrack.Controls.Add($pbFill)

# Status
$lbStatus          = New-Object Windows.Forms.Label
$lbStatus.Text     = "Inicjalizacja..."
$lbStatus.Font     = New-Object Drawing.Font("Segoe UI", 9)
$lbStatus.ForeColor = $MUTED
$lbStatus.Size     = New-Object Drawing.Size(420, 20)
$lbStatus.Location = New-Object Drawing.Point(20, 230)
$form.Controls.Add($lbStatus)

function DoEvents { [Windows.Forms.Application]::DoEvents() }

function Set-Step($pct, $msg, $active, $completed = -1) {
    $pbFill.Width      = [int](420 * $pct / 100)
    $lbStatus.Text     = $msg
    for ($i = 0; $i -lt 4; $i++) {
        if ($i -lt $completed) {
            $stepLabels[$i].ForeColor = $GREEN
            $stepLabels[$i].Text = "[+] $($steps[$i])"
        } elseif ($i -eq $active) {
            $stepLabels[$i].ForeColor = $WHITE
            $stepLabels[$i].Text = " >  $($steps[$i])..."
        } else {
            $stepLabels[$i].ForeColor = $MUTED
            $stepLabels[$i].Text = "    $($steps[$i])"
        }
    }
    $form.Refresh(); DoEvents
}

$form.Show(); DoEvents

# Krok 1: Docker
Set-Step 5 "Sprawdzanie Docker..." 0

docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Set-Step 8 "Uruchamianie Docker Desktop..." 0
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
    $w = 0
    while ($w -lt 120) {
        Start-Sleep -Seconds 3; $w += 3
        docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
        Set-Step ([math]::Min(8 + $w/2, 24)) "Czekam na Docker... ($w s)" 0
    }
}
Set-Step 25 "Docker gotowy" 1 1; Start-Sleep -Milliseconds 200

# Krok 2: git pull
Set-Step 35 "Pobieranie aktualizacji..." 1 1
git pull --quiet 2>&1 | Out-Null
Set-Step 50 "Aktualizacje pobrane" 2 2; Start-Sleep -Milliseconds 200

# Krok 3: compose up (--build przebudowuje obraz po git pull)
Set-Step 58 "Budowanie i uruchamianie kontenera..." 2 2
docker-compose up -d --build 2>&1 | Out-Null
Set-Step 75 "Kontener uruchomiony" 3 3; Start-Sleep -Milliseconds 200

# Krok 4: health check
Set-Step 80 "Czekam az aplikacja bedzie gotowa..." 3 3
$w = 0
while ($w -lt 90) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8080/api/tests" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { break }
    } catch {}
    Start-Sleep -Seconds 2; $w += 2
    Set-Step ([math]::Min(80 + $w, 98)) "Czekam... ($w s)" 3 3
}

# Gotowe — zielony, otwierz browser, zamknij
for ($i = 0; $i -lt 4; $i++) {
    $stepLabels[$i].ForeColor = $GREEN
    $stepLabels[$i].Text = "[+] $($steps[$i])"
}
$pbFill.Width     = 420
$pbFill.BackColor = $GREEN
$lbStatus.Text    = "Gotowe! Otwieram aplikacje..."
$lbStatus.ForeColor = $GREEN
$form.Refresh(); DoEvents

Start-Process "http://localhost:8080"
Start-Sleep -Milliseconds 1200
$form.Close()
