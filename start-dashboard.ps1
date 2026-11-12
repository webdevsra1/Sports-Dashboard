param(
    [int]$Port = 8080,
    [switch]$NoOpen
)

$ErrorActionPreference = "Stop"
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
$RootDir = [System.IO.Path]::GetFullPath($PSScriptRoot)

$MimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".xml"  = "application/xml; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".ico"  = "image/x-icon"
}

$AllowedSoccerLeagues = @(
    "eng.1", "uefa.nations", "uefa.champions", "uefa.europa", "uefa.europa.conf",
    "esp.1", "ita.1", "ger.1", "fra.1", "usa.1",
    "fifa.world", "fifa.worldq.uefa", "fifa.worldq.conmebol", "fifa.friendly", "concacaf.nations", "all"
)

$AllowedOpenF1Resources = @(
    "sessions", "drivers", "position", "intervals", "stints", "laps", "race_control", "weather"
)

function Parse-QueryString {
    param([string]$QueryPart)
    $map = @{}
    if ([string]::IsNullOrWhiteSpace($QueryPart)) { return $map }
    $pairs = $QueryPart.TrimStart("?") -split "&"
    foreach ($p in $pairs) {
        if ([string]::IsNullOrWhiteSpace($p)) { continue }
        $kv = $p -split "=", 2
        $k = [System.Uri]::UnescapeDataString($kv[0])
        $v = if ($kv.Length -gt 1) { [System.Uri]::UnescapeDataString($kv[1]) } else { "" }
        $map[$k] = $v
    }
    return $map
}

function Invoke-UpstreamRequest {
    param(
        [string]$Url,
        [string]$Referer = "",
        [string]$Origin = ""
    )
    $req = [System.Net.HttpWebRequest]::Create($Url)
    $req.Method = "GET"
    $req.Timeout = 6500
    $req.ReadWriteTimeout = 6500
    $req.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
    $req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    $req.Accept = "application/json, application/xml, text/xml, */*"
    if (-not [string]::IsNullOrEmpty($Referer)) { $req.Referer = $Referer }
    if (-not [string]::IsNullOrEmpty($Origin)) { $req.Headers.Add("Origin", $Origin) }

    $resp = $req.GetResponse()
    try {
        $respStream = $resp.GetResponseStream()
        $ms = New-Object System.IO.MemoryStream
        $respStream.CopyTo($ms)
        return $ms.ToArray()
    } finally {
        $resp.Close()
    }
}

function Send-HttpResponse {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$StatusCode,
        [string]$StatusText,
        [string]$ContentType,
        [byte[]]$BodyBytes
    )
    $headerText = "HTTP/1.1 $StatusCode $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($BodyBytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerText)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($BodyBytes.Length -gt 0) {
        $Stream.Write($BodyBytes, 0, $BodyBytes.Length)
    }
    $Stream.Flush()
}

function Resolve-UpstreamTarget {
    param(
        [string]$Path,
        [hashtable]$Query
    )

    $dateQuery = ""
    if ($Query -and ($Query["dates"] -match "^\d{8}$")) {
        $dateQuery = "?dates=$($Query['dates'])"
    }

    if ($Path -eq "/api/espn/soccer/news") {
        return @{ url = "https://site.api.espn.com/apis/site/v2/sports/soccer/all/news?limit=10"; mime = "application/json; charset=utf-8" }
    }
    if ($Path -match "^/api/espn/soccer/([a-z0-9.]+)$") {
        $lg = $Matches[1]
        if ($AllowedSoccerLeagues -contains $lg) {
            return @{ url = "https://site.api.espn.com/apis/site/v2/sports/soccer/$lg/scoreboard$dateQuery"; mime = "application/json; charset=utf-8" }
        }
    }
    if ($Path -match "^/api/espn/soccer/([a-z0-9.]+)/summary$") {
        $lg = $Matches[1]
        $ev = $Query["event"]
        if (($AllowedSoccerLeagues -contains $lg) -and ($ev -match "^\d+$")) {
            return @{ url = "https://site.api.espn.com/apis/site/v2/sports/soccer/$lg/summary?event=$ev"; mime = "application/json; charset=utf-8" }
        }
    }
    if ($Path -eq "/api/espn/f1") {
        return @{ url = "https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard"; mime = "application/json; charset=utf-8" }
    }
    if ($Path -eq "/api/espn/f1/news") {
        return @{ url = "https://site.api.espn.com/apis/site/v2/sports/racing/f1/news?limit=8"; mime = "application/json; charset=utf-8" }
    }
    if ($Path -eq "/api/jolpi/f1") {
        return @{ url = "https://api.jolpi.ca/ergast/f1/current/last/results.json"; mime = "application/json; charset=utf-8" }
    }
    if ($Path -match "^/api/openf1/([a-z_]+)$") {
        $res = $Matches[1]
        if ($AllowedOpenF1Resources -contains $res) {
            $qs = "session_key=latest"
            if ($Query.ContainsKey("minLap") -and ($Query["minLap"] -match "^\d+$")) {
                $qs += "&lap_number%3E=$($Query['minLap'])"
            }
            return @{ url = "https://api.openf1.org/v1/${res}?${qs}"; mime = "application/json; charset=utf-8" }
        }
    }
    if ($Path -eq "/api/cricket/espn" -or $Path -eq "/api/cricket/espn-scorepanel") {
        return @{ url = "https://site.web.api.espn.com/apis/site/v2/sports/cricket/scorepanel$dateQuery"; mime = "application/json; charset=utf-8" }
    }
    if ($Path -eq "/api/cricket/espn-header") {
        return @{ url = "https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&lang=en&region=in"; mime = "application/json; charset=utf-8" }
    }
    if ($Path -eq "/api/cricket/espn-ipl") {
        return @{ url = "https://site.web.api.espn.com/apis/site/v2/sports/cricket/8048/scoreboard$dateQuery"; mime = "application/json; charset=utf-8" }
    }
    if ($Path -match "^/api/cricket/espn-league/(\d+)$") {
        $lid = $Matches[1]
        return @{ url = "https://site.web.api.espn.com/apis/site/v2/sports/cricket/${lid}/scoreboard$dateQuery"; mime = "application/json; charset=utf-8" }
    }
    if ($Path -match "^/api/cricket/espn-summary/(\d+)$") {
        $lid = $Matches[1]
        $ev = $Query["event"]
        if ($ev -match "^\d+$") {
            return @{ url = "https://site.web.api.espn.com/apis/site/v2/sports/cricket/${lid}/summary?contentorigin=espn&event=${ev}&lang=en&region=in"; mime = "application/json; charset=utf-8" }
        }
    }
    if ($Path -eq "/api/cricket/news") {
        return @{ url = "https://site.api.espn.com/apis/site/v2/sports/cricket/news?limit=8"; mime = "application/json; charset=utf-8" }
    }
    if ($Path -eq "/api/cricket/rss") {
        return @{ url = "https://static.cricinfo.com/rss/livescores.xml"; mime = "application/xml; charset=utf-8" }
    }
    if ($Path -eq "/api/cricket/cricinfo-page") {
        return @{
            url       = "https://www.espncricinfo.com/live-cricket-score"
            mime      = "application/json; charset=utf-8"
            referer   = "https://www.espncricinfo.com/"
            extractNd = $true
        }
    }
    if ($Path -eq "/api/cricket/cricinfo") {
        return @{
            url     = "https://hs-consumer-api.espncricinfo.com/v1/pages/matches/current?lang=en&latest=true"
            mime    = "application/json; charset=utf-8"
            referer = "https://www.espncricinfo.com/"
            origin  = "https://www.espncricinfo.com"
        }
    }
    if ($Path -eq "/api/cricket/cricinfo-details") {
        $sid = $Query["seriesId"]
        $mid = $Query["matchId"]
        if (($sid -match "^\d+$") -and ($mid -match "^\d+$")) {
            return @{
                url     = "https://hs-consumer-api.espncricinfo.com/v1/pages/match/details?lang=en&seriesId=$sid&matchId=$mid&latest=true"
                mime    = "application/json; charset=utf-8"
                referer = "https://www.espncricinfo.com/"
                origin  = "https://www.espncricinfo.com"
            }
        }
    }
    if ($Path -eq "/api/cricket/cricapi") {
        $key = $Query["apikey"]
        if ($key -match "^[a-zA-Z0-9_-]{8,128}$") {
            return @{ url = "https://api.cricapi.com/v1/currentMatches?apikey=$key&offset=0"; mime = "application/json; charset=utf-8" }
        }
    }
    return $null
}

$Listener = $null
$BoundPort = $Port
foreach ($candidate in @($Port, 8081, 8082, 8083, 8084, 8085)) {
    try {
        $testListener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $candidate)
        $testListener.Start()
        $Listener = $testListener
        $BoundPort = $candidate
        break
    } catch {
        # Try next loopback port
    }
}

if ($null -eq $Listener) {
    Write-Error "Unable to bind any local loopback port between $Port and 8085."
    exit 1
}

$BaseUrl = "http://127.0.0.1:$BoundPort/"
Write-Host "Sports Dashboard running at $BaseUrl"
Write-Host "Live proxy enabled for Football (ESPN), Cricket (ESPN Men's Intl/IPL, CricAPI, Cricinfo), and Formula 1 (OpenF1/ESPN/Jolpica)."
Write-Host "Press Ctrl+C to stop."

if (-not $NoOpen) {
    Start-Process $BaseUrl
}

try {
    while ($true) {
        $Client = $Listener.AcceptTcpClient()
        try {
            $Client.ReceiveTimeout = 5000
            $Stream = $Client.GetStream()
            $Reader = New-Object System.IO.StreamReader($Stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $RequestLine = $Reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($RequestLine)) { continue }

            while ($true) {
                $Line = $Reader.ReadLine()
                if ([string]::IsNullOrEmpty($Line)) { break }
            }

            $Parts = $RequestLine.Split(" ")
            $RawTarget = if ($Parts.Length -ge 2) { $Parts[1] } else { "/" }
            $SplitTarget = $RawTarget -split "\?", 2
            $RawPath = $SplitTarget[0]
            $QueryPart = if ($SplitTarget.Length -gt 1) { $SplitTarget[1] } else { "" }
            $QueryMap = Parse-QueryString -QueryPart $QueryPart

            if ($RawPath -eq "/api/health") {
                $Health = [System.Text.Encoding]::UTF8.GetBytes("{`"ok`":true,`"app`":`"Sports Dashboard`",`"port`":$BoundPort}")
                Send-HttpResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -ContentType "application/json; charset=utf-8" -BodyBytes $Health
                continue
            }

            if ($RawPath.StartsWith("/api/")) {
                $Target = Resolve-UpstreamTarget -Path $RawPath -Query $QueryMap
                if ($null -eq $Target) {
                    $Bad = [System.Text.Encoding]::UTF8.GetBytes("{`"error`":`"Invalid API route`"}")
                    Send-HttpResponse -Stream $Stream -StatusCode 400 -StatusText "Bad Request" -ContentType "application/json; charset=utf-8" -BodyBytes $Bad
                    continue
                }
                try {
                    $Payload = Invoke-UpstreamRequest -Url $Target.url -Referer ($Target.referer -as [string]) -Origin ($Target.origin -as [string])
                    if ($Target.extractNd) {
                        $htmlText = [System.Text.Encoding]::UTF8.GetString($Payload)
                        if ($htmlText -match '(?s)<script id="__NEXT_DATA__"[^>]*>(.*?)</script>') {
                            $Payload = [System.Text.Encoding]::UTF8.GetBytes($Matches[1])
                        } else {
                            throw "Missing Next data payload"
                        }
                    }
                    Send-HttpResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -ContentType $Target.mime -BodyBytes $Payload
                } catch {
                    $ErrMsg = ($_.Exception.Message -replace '"', "'")
                    $ErrBytes = [System.Text.Encoding]::UTF8.GetBytes("{`"error`":`"Upstream feed unavailable`",`"detail`":`"$ErrMsg`"}")
                    Send-HttpResponse -Stream $Stream -StatusCode 502 -StatusText "Bad Gateway" -ContentType "application/json; charset=utf-8" -BodyBytes $ErrBytes
                }
                continue
            }

            $RelPath = if ($RawPath -eq "/") { "index.html" } else { $RawPath.TrimStart("/") }
            $SafeRel = $RelPath.Replace("/", [System.IO.Path]::DirectorySeparatorChar)
            $FullPath = [System.IO.Path]::GetFullPath((Join-Path $RootDir $SafeRel))

            if (-not $FullPath.StartsWith($RootDir, [System.StringComparison]::OrdinalIgnoreCase)) {
                $Forbidden = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden")
                Send-HttpResponse -Stream $Stream -StatusCode 403 -StatusText "Forbidden" -ContentType "text/plain; charset=utf-8" -BodyBytes $Forbidden
            } elseif (Test-Path -LiteralPath $FullPath -PathType Leaf) {
                $Ext = [System.IO.Path]::GetExtension($FullPath).ToLowerInvariant()
                $Mime = if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { "application/octet-stream" }
                $Bytes = [System.IO.File]::ReadAllBytes($FullPath)
                Send-HttpResponse -Stream $Stream -StatusCode 200 -StatusText "OK" -ContentType $Mime -BodyBytes $Bytes
            } else {
                $NotFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                Send-HttpResponse -Stream $Stream -StatusCode 404 -StatusText "Not Found" -ContentType "text/plain; charset=utf-8" -BodyBytes $NotFound
            }
        } catch {
            Write-Warning ("Client request failed: " + $_.Exception.Message)
        } finally {
            $Client.Close()
        }
    }
} finally {
    $Listener.Stop()
}
