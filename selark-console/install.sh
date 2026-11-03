#!/usr/bin/env bash
# Install Selark Console as the front end of an installed `selark dashboard`.
#
#   ./install.sh                      # auto-detect (pipx venv, then python3)
#   ./install.sh /path/to/dashboard_assets
#   ./install.sh --restore            # put the most recent backup back
#
# The original assets are backed up next to the target as dashboard_assets.bak-<time>.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILES=(index.html assets/app.js assets/style.css assets/mark.svg)

find_target() {
  local py
  for py in "$HOME/.local/share/pipx/venvs/selark/bin/python" "$(command -v python3 || true)"; do
    [ -x "$py" ] || continue
    if "$py" -c 'import selark' 2>/dev/null; then
      "$py" -c 'import pathlib, selark; print(pathlib.Path(selark.__file__).parent / "dashboard_assets")'
      return 0
    fi
  done
  return 1
}

restore=0
if [ "${1:-}" = "--restore" ]; then restore=1; shift; fi
TARGET="${1:-$(find_target || true)}"
if [ -z "$TARGET" ] || [ ! -d "$TARGET" ]; then
  echo "找不到 Selark 的 dashboard_assets 目录，请把路径作为参数传入。" >&2
  exit 1
fi
TARGET="$(cd "$TARGET" && pwd)"

if [ "$restore" = 1 ]; then
  latest="$(ls -d "$TARGET".bak-* 2>/dev/null | sort | tail -n 1 || true)"
  [ -n "$latest" ] || { echo "没有找到备份：$TARGET.bak-*" >&2; exit 1; }
  cp -p "$latest"/* "$TARGET"/
  echo "已从 $latest 恢复原版 Dashboard。"
  exit 0
fi

backup="$TARGET.bak-$(date +%Y%m%d%H%M%S)"
cp -rp "$TARGET" "$backup"
cp "$HERE/index.html" "$TARGET/index.html"
for f in app.js style.css mark.svg; do cp "$HERE/assets/$f" "$TARGET/$f"; done
echo "Selark Console 已安装到 $TARGET"
echo "原版文件备份在 $backup（可用 ./install.sh --restore 恢复）"
echo "运行 selark dashboard 即可使用；注意 pipx reinstall / upgrade 会覆盖为原版。"
