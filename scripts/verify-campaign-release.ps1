$ErrorActionPreference = 'Stop'
$origin = 'https://capone-private-studio.capone-studio-136.workers.dev'
$directory = Join-Path (Get-Location) '.private/campaign-release'
$release = Get-Content -LiteralPath (Join-Path $directory 'verification.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$page = Invoke-WebRequest -Uri "$origin/" -TimeoutSec 90
if ($page.StatusCode -ne 200) { throw 'Homepage unavailable.' }
$previous = -1
foreach ($marker in @('id="official-contact"','class="hero"','id="lineage"','id="concerns"','id="approach"','id="directions"','id="journal"','id="contact"')) {
  $position = $page.Content.IndexOf($marker)
  if ($position -le $previous) { throw "Incorrect homepage order: $marker" }
  $previous = $position
}
foreach ($text in @('wasd562482','Jw512527','+86 198 0507 1031','福利日','替他的敷衍买单','婚姻修复','后续定制或仪式服务不包含在免费权益内')) {
  if (!$page.Content.Contains($text)) { throw "Missing page content: $text" }
}
$firstResponse = Invoke-WebRequest -Uri "$origin/api/campaign" -TimeoutSec 90
$first = $firstResponse.Content | ConvertFrom-Json
$second = Invoke-RestMethod -Uri "$origin/api/campaign" -TimeoutSec 90
if ($firstResponse.Headers['Cache-Control'] -notcontains 'no-store') { throw 'Campaign response must not be cached.' }
if ($first.startsAt -ne $second.startsAt -or $first.endsAt -ne $second.endsAt -or $first.endsAt -ne $release.campaign.endsAt) { throw 'Campaign deadline changed.' }
if ($first.endsAt - $first.startsAt -ne 86400000) { throw 'Campaign duration is not 24 hours.' }
if ($first.status -ne 'active') { throw "Campaign is not active: $($first.status)" }
$allPosts = @()
do {
  $response = Invoke-RestMethod -Uri "$origin/api/posts?offset=$($allPosts.Count)" -TimeoutSec 90
  $allPosts += $response.posts
  if ($allPosts.Count -gt 100) { throw 'Unexpected pagination.' }
} while ($response.hasMore)
$videos = @($allPosts | Where-Object kind -EQ 'video')
if (@($videos | Where-Object { !$_.posterId -or !$_.posterUrl }).Count) { throw 'A video cover is missing.' }
$cover = Invoke-WebRequest -Uri ($origin + $videos[0].posterUrl) -TimeoutSec 90
if ($cover.StatusCode -ne 200) { throw 'Video poster unavailable.' }
$admin = Invoke-WebRequest -Uri "$origin/api/admin/me" -SkipHttpErrorCheck -TimeoutSec 90
if ($admin.StatusCode -ne 401) { throw 'Admin protection failed.' }
$report = @{verifiedAt=(Get-Date).ToUniversalTime().ToString('o');origin=$origin;campaign=$first;pageOrderVerified=$true;postCount=$allPosts.Count;videoCount=$videos.Count;postersPresent=$true;adminProtected=$true;homepageCacheControl=$page.Headers['Cache-Control']}
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $directory 'public-verification.json') -Encoding UTF8
$report | ConvertTo-Json -Depth 5
