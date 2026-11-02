param(
    [string]$Root = (Get-Location).Path
)

Add-Type -AssemblyName System.Drawing

$srcIcon = Join-Path $Root 'public\maestria-logo-icon.png'
$iconsDir = Join-Path $Root 'public\icons'
if (-not (Test-Path -LiteralPath $iconsDir)) { New-Item -ItemType Directory -Path $iconsDir | Out-Null }

function New-LogoBitmap {
    param([int]$Size, [double]$Padding, [bool]$Rounded)
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $rect = New-Object System.Drawing.Rectangle 0, 0, $Size, $Size
    if ($Rounded) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $radius = [int]([Math]::Max(2, $Size * 0.18))
        $d = $radius * 2
        $path.AddArc(0, 0, $d, $d, 180, 90)
        $path.AddArc($Size - $d, 0, $d, $d, 270, 90)
        $path.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
        $path.AddArc(0, $Size - $d, $d, $d, 90, 90)
        $path.CloseFigure()
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
        $g.FillPath($brush, $path)
        $brush.Dispose(); $path.Dispose()
    }
    else {
        $g.Clear([System.Drawing.Color]::White)
    }
    $inner = [int]($Size * (1 - 2 * $Padding))
    $off = [int]($Size * $Padding)
    $src = [System.Drawing.Image]::FromFile($srcIcon)
    $g.DrawImage($src, $off, $off, $inner, $inner)
    $src.Dispose()
    $g.Dispose()
    return $bmp
}

$png = [System.Drawing.Imaging.ImageFormat]::Png

# Regular + maskable PWA icons
foreach ($s in @(72, 96, 128, 144, 152, 180, 192, 384, 512)) {
    $b = New-LogoBitmap -Size $s -Padding 0.06 -Rounded $true
    $b.Save((Join-Path $iconsDir "icon-$($s)x$($s).png"), $png)
    $b.Dispose()
    Write-Output "icon-$($s)x$($s).png"
}

# Maskable variants need full-bleed background and a safe-zone inset
foreach ($s in @(192, 512)) {
    $b = New-LogoBitmap -Size $s -Padding 0.20 -Rounded $false
    $b.Save((Join-Path $iconsDir "icon-maskable-$($s)x$($s).png"), $png)
    $b.Dispose()
    Write-Output "icon-maskable-$($s)x$($s).png"
}

# favicon.ico - container with embedded PNG entries (supported by all modern browsers)
$sizes = @(16, 32, 48, 64)
$perSize = @()
foreach ($s in $sizes) {
    $b = New-LogoBitmap -Size $s -Padding 0.04 -Rounded $false
    $m = New-Object System.IO.MemoryStream
    $b.Save($m, $png)
    $perSize += , @($s, $m.ToArray())
    $m.Dispose(); $b.Dispose()
}

$out = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $out
$bw.Write([UInt16]0)                 # reserved
$bw.Write([UInt16]1)                 # type: icon
$bw.Write([UInt16]$perSize.Count)    # count
$offset = 6 + 16 * $perSize.Count
foreach ($entry in $perSize) {
    $s = $entry[0]; $data = $entry[1]
    $dim = if ($s -ge 256) { 0 } else { [Byte]$s }
    $bw.Write($dim)                   # width
    $bw.Write($dim)                   # height
    $bw.Write([Byte]0)                # palette entries
    $bw.Write([Byte]0)                # reserved
    $bw.Write([UInt16]1)              # planes
    $bw.Write([UInt16]32)             # bits per pixel
    $bw.Write([UInt32]$data.Length)   # size of image data
    $bw.Write([UInt32]$offset)        # offset
    $offset += $data.Length
}
foreach ($entry in $perSize) { $bw.Write($entry[1]) }
$bw.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $Root 'public\favicon.ico'), $out.ToArray())
$bw.Dispose(); $out.Dispose()
Write-Output "favicon.ico"

# Open Graph card 1200x630
$ogW = 1200; $ogH = 630
$og = New-Object System.Drawing.Bitmap $ogW, $ogH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($og)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
$rectF = New-Object System.Drawing.RectangleF 0, 0, $ogW, $ogH
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rectF, ([System.Drawing.Color]::FromArgb(255, 168, 85, 247)), ([System.Drawing.Color]::FromArgb(255, 30, 27, 75)), 35.0
$g.FillRectangle($grad, 0, 0, $ogW, $ogH)
$grad.Dispose()

$logoSize = 300
$logo = New-LogoBitmap -Size $logoSize -Padding 0.06 -Rounded $true
$g.DrawImage($logo, 70, 165, $logoSize, $logoSize)
$logo.Dispose()

$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$soft = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 230, 225, 255))
$titleFont = New-Object System.Drawing.Font ('Segoe UI', 88, ([System.Drawing.FontStyle]::Bold))
$subFont = New-Object System.Drawing.Font ('Segoe UI', 34, ([System.Drawing.FontStyle]::Regular))
$sf = New-Object System.Drawing.StringFormat
$sf.FormatFlags = $sf.FormatFlags -bor ([System.Drawing.StringFormatFlags]::NoWrap)
$g.DrawString('Maestria', $titleFont, $white, (New-Object System.Drawing.PointF 420, 210), $sf)
$g.DrawString('by Maestro7IT', $subFont, $soft, (New-Object System.Drawing.PointF 424, 330), $sf)
$tagFont = New-Object System.Drawing.Font ('Segoe UI', 30, ([System.Drawing.FontStyle]::Regular))
$g.DrawString([char]0x041E + [char]0x0431 + [char]0x0443 + [char]0x0447 + [char]0x0435 + [char]0x043D + [char]0x0438 + [char]0x0435 + ' ' + [char]0x043F + [char]0x0440 + [char]0x043E + [char]0x0433 + [char]0x0440 + [char]0x0430 + [char]0x043C + [char]0x043C + [char]0x0438 + ' ' + [char]0x0440 + [char]0x044F + [char]0x0434 + [char]0x043E + [char]0x043C, $tagFont, $soft, (New-Object System.Drawing.PointF 74, 500), $sf)
$sf.Dispose(); $tagFont.Dispose(); $subFont.Dispose(); $titleFont.Dispose()
$soft.Dispose(); $white.Dispose()
$g.Dispose()
$og.Save((Join-Path $Root 'public\og-image.png'), $png)
$og.Dispose()
Write-Output "og-image.png"
Write-Output "DONE"
