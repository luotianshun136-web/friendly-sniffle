$ErrorActionPreference = 'Stop'
$origin = 'https://capone-private-studio.capone-studio-136.workers.dev'
$directory = Join-Path (Get-Location) '.private/lineage-release'
$manifest = Get-Content -LiteralPath (Join-Path $directory 'release-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$page = Invoke-WebRequest -Uri "$origin/" -TimeoutSec 90
if ($page.StatusCode -ne 200 -or !$page.Content.Contains('仪式理念') -or !$page.Content.Contains('其他疑难杂症') -or !$page.Content.Contains('lineage-altar-v1-480.webp')) { throw 'Homepage content verification failed.' }
$posts = @()
do {
  $offset = $posts.Count
  $response = Invoke-RestMethod -Uri "$origin/api/posts?offset=$offset" -TimeoutSec 90
  $posts += $response.posts
  if ($posts.Count -gt 100) { throw 'Unexpected pagination result.' }
} while ($response.hasMore)
$videos = @($posts | Where-Object kind -EQ 'video')
foreach ($post in $videos) {
  if (!$post.posterUrl -or !$post.posterId) { throw "Missing poster: $($post.id)" }
  $target = Join-Path $directory ("verified-" + $post.posterId + '.webp')
  Invoke-WebRequest -Uri ($origin + $post.posterUrl) -OutFile $target -TimeoutSec 90
  $item = $manifest.items | Where-Object id -EQ $post.posterId
  if ($item -and (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256) { throw 'Published poster differs from prepared poster.' }
}
$newPost = $posts | Where-Object id -EQ $manifest.newPost.id
if (!$newPost.loop -or $newPost.title -ne '团队影像 · 仪式片段') { throw 'New short film verification failed.' }
$clip = Join-Path $directory 'verified-new-clip.mp4'
Invoke-WebRequest -Uri "$origin/api/media/$($newPost.mediaId)" -OutFile $clip -TimeoutSec 90
$expected = $manifest.items | Where-Object id -EQ $newPost.mediaId
if ((Get-FileHash -LiteralPath $clip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected.sha256) { throw 'Published video differs from audio-preserving source.' }
$range = Invoke-WebRequest -Uri "$origin/api/media/$($newPost.mediaId)" -Headers @{Range='bytes=0-31'} -TimeoutSec 90
if ($range.StatusCode -ne 206) { throw 'Video seeking response failed.' }
try { Invoke-WebRequest -Uri "$origin/api/admin/me" -TimeoutSec 90 | Out-Null; throw 'Admin unexpectedly public.' }
catch { if ([int]$_.Exception.Response.StatusCode -ne 401) { throw } }
$report = @{checkedAt=(Get-Date).ToUniversalTime().ToString('o');origin=$origin;publicPosts=$posts.Count;videoPosts=$videos.Count;postersVerified=$videos.Count;newClipBytesMatch=$true;rangeStatus=$range.StatusCode;adminProtected=$true}
$report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $directory 'public-verification.json') -Encoding UTF8
$report | ConvertTo-Json
