Add-Type -AssemblyName System.Drawing

$sourcePath = 'C:\Users\matheus.ribeiro\.gemini\antigravity\brain\70836add-84a8-43a6-bb02-39689855c559\ferias_inteligente_app_icon_v3_1793906469825.jpg'
$baseDir = Split-Path -Parent $PSScriptRoot

function Resize-Image($src, $dst, $w, $h) {
    $srcImg = [System.Drawing.Image]::FromFile($src)
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($srcImg, 0, 0, $w, $h)
    $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $srcImg.Dispose()
    Write-Host "Generated: $dst ($w x $h)"
}

function Generate-Maskable($src, $dst, $size) {
    $srcImg = [System.Drawing.Image]::FromFile($src)
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background color #0b4696
    $bgColor = [System.Drawing.Color]::FromArgb(255, 11, 70, 150)
    $brush = New-Object System.Drawing.SolidBrush($bgColor)
    $g.FillRectangle($brush, 0, 0, $size, $size)

    $innerSize = [int]($size * 0.82)
    $offset = [int](($size - $innerSize) / 2)
    $g.DrawImage($srcImg, $offset, $offset, $innerSize, $innerSize)

    $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
    $brush.Dispose()
    $g.Dispose()
    $bmp.Dispose()
    $srcImg.Dispose()
    Write-Host "Generated maskable: $dst ($size x $size)"
}

Resize-Image $sourcePath "$baseDir\icons\icon-512.png" 512 512
Resize-Image $sourcePath "$baseDir\icons\icon-192.png" 192 192
Resize-Image $sourcePath "$baseDir\icons\apple-touch-icon.png" 180 180
Resize-Image $sourcePath "$baseDir\icons\favicon.png" 64 64
Generate-Maskable $sourcePath "$baseDir\icons\icon-maskable-512.png" 512
Copy-Item "$baseDir\icons\favicon.png" "$baseDir\favicon.ico" -Force
Write-Host "All icons updated successfully with the new Férias Inteligente logo!"
