$ErrorActionPreference = 'Stop'
$botToken = (Get-Clipboard -Raw).Trim()
try {
  if ($botToken -notmatch '^\d{6,}:[A-Za-z0-9_-]{20,}$') {
    throw 'Clipboard does not contain a BotFather token.'
  }

  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $webhookSecret = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')

  $botToken | npx --yes wrangler@latest pages secret put TELEGRAM_BOT_TOKEN --project-name quick-stock-2028
  if ($LASTEXITCODE -ne 0) { throw 'Could not save the Telegram token in Cloudflare.' }
  $webhookSecret | npx --yes wrangler@latest pages secret put TELEGRAM_WEBHOOK_SECRET --project-name quick-stock-2028
  if ($LASTEXITCODE -ne 0) { throw 'Could not save the webhook secret in Cloudflare.' }

  $body = @{
    url = 'https://quick-stock-2028.pages.dev/api/telegram'
    secret_token = $webhookSecret
    allowed_updates = @('message')
    drop_pending_updates = $true
  } | ConvertTo-Json -Compress
  try {
    $result = Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/setWebhook" -Method Post -ContentType 'application/json' -Body $body
    if (-not $result.ok) { throw 'Telegram rejected the webhook.' }
  } catch {
    throw 'Telegram webhook registration failed. The Cloudflare secrets were saved; retry after checking the token.'
  }
  Write-Output 'Telegram token and webhook secret saved in Cloudflare; webhook registered.'
} finally {
  Set-Clipboard -Value ' '
  $botToken = $null
}
