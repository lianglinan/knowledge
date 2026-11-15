param(
    [string]$Message = "update content"
)

# 一键提交并推送。用法：.\publish.ps1 "补充 30 天内容"
# 第一次运行前，先确认已设置好远端：
#   git remote add origin https://github.com/lianglinan/knowledge.git
#   git branch -M main

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".git")) {
    Write-Host "这里还不是 git 仓库，先执行 git init。" -ForegroundColor Red
    exit 1
}

$remote = git remote 2>$null
if (-not $remote) {
    Write-Host "还没配置远端。先执行：" -ForegroundColor Yellow
    Write-Host "  git remote add origin https://github.com/lianglinan/knowledge.git" -ForegroundColor Cyan
    Write-Host "  git branch -M main" -ForegroundColor Cyan
    exit 1
}

# 提交前先跑一遍测试，防止把坏掉的内容推上去
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    Write-Host "运行测试..." -ForegroundColor DarkGray
    node _test.js
    if ($LASTEXITCODE -ne 0) {
        Write-Host "测试未通过，已中止推送。" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "未找到 node，跳过测试。" -ForegroundColor Yellow
}

git add -A
$dirty = git status --porcelain
if (-not $dirty) {
    Write-Host "没有改动，无需推送。" -ForegroundColor DarkGray
    exit 0
}

git commit -m $Message
git push

Write-Host "`n完成。GitHub Pages 大约 1 分钟后生效。" -ForegroundColor Green
Write-Host "手机上下拉刷新即可，已有卡片不受影响。" -ForegroundColor Green
