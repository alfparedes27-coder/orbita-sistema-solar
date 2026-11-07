@echo off
rem Abre el simulador Orbita desde un pequeno servidor local para que los videos de YouTube se vean dentro de la pagina.
rem Pon este archivo en la misma carpeta que el .html del simulador y hazle doble clic. Cierra esta ventana para apagarlo.
cd /d "%~dp0"
echo Iniciando el simulador en http://localhost:8765/ ...
echo Cierra esta ventana cuando termines.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$f=(Get-ChildItem -Filter '*.html' | Sort-Object LastWriteTime -Descending | Select-Object -First 1).Name; if(-not $f){Write-Host 'No encuentro el archivo Orbita*.html en esta carpeta.'; pause; exit}; $l=New-Object Net.HttpListener; $l.Prefixes.Add('http://localhost:8765/'); $l.Start(); Start-Process ('http://localhost:8765/' + [Uri]::EscapeDataString($f)); while($l.IsListening){ $c=$l.GetContext(); $p=Join-Path (Get-Location) ([Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))); if(Test-Path -LiteralPath $p -PathType Leaf){ $b=[IO.File]::ReadAllBytes($p); if($p -like '*.html'){ $c.Response.ContentType='text/html; charset=utf-8' }; $c.Response.OutputStream.Write($b,0,$b.Length) } else { $c.Response.StatusCode=404 }; $c.Response.Close() }"
