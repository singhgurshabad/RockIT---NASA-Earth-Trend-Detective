#!/usr/bin/env bash
# Applies the RockIT update to your own copy of the repository.
#
#   bash handoff/apply_update.sh /path/to/your/RockIT-repo            # shows the plan, asks, then applies
#   bash handoff/apply_update.sh /path/to/your/RockIT-repo --dry-run  # shows the plan only
#
# What it does:
#   1. checks the target is the RockIT git repository and shows its branch
#   2. refuses to run on main/master
#   3. lists every file it will add, replace or remove (and warns about files you edited since the upload)
#   4. copies every file it is about to replace or remove into a backup folder NEXT TO the repo
#   5. copies the new files in
# What it never does: touch .env files, node_modules or virtual environments; commit, push, merge or deploy.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$(cd "$HERE/.." && pwd)"
LIST="$HERE/CHANGED_FILES.txt"
TARGET="${1:-}"
MODE="${2:-}"

say()  { printf '%s\n' "$*"; }
stop() { printf '\nSTOPPED: %s\n' "$*" >&2; exit 1; }

[ -n "$TARGET" ] || stop "Give the path to your repository:  bash handoff/apply_update.sh /path/to/your/repo"
[ -d "$TARGET" ] || stop "'$TARGET' is not a folder."
TARGET="$(cd "$TARGET" && pwd)"
[ -f "$LIST" ] || stop "Cannot find $LIST. Run this script from the unzipped update folder."
[ "$TARGET" != "$SRC" ] || stop "The target is the update folder itself. Point at your own repository."

git -C "$TARGET" rev-parse --is-inside-work-tree >/dev/null 2>&1 || stop "'$TARGET' is not a git repository."
[ "$(cd "$(git -C "$TARGET" rev-parse --show-toplevel)" && pwd)" = "$TARGET" ] || stop "Point at the top folder of the repository (the one containing api/ and rockit/)."
[ -f "$TARGET/api/main.py" ] && [ -f "$TARGET/rockit/package.json" ] && [ -d "$TARGET/api/data/rockit" ] \
  || stop "'$TARGET' does not look like the RockIT project (expected api/main.py, rockit/package.json, api/data/rockit/)."

BRANCH="$(git -C "$TARGET" rev-parse --abbrev-ref HEAD)"
REMOTE="$(git -C "$TARGET" remote get-url origin 2>/dev/null || echo 'no remote named origin')"
say "Repository : $TARGET"
say "Remote     : $REMOTE"
say "Branch     : $BRANCH"
case "$BRANCH" in
  main|master|HEAD) stop "You are on '$BRANCH'. Switch to your experiment branch first, for example:  git switch -c rockit-redesign" ;;
esac

if command -v sha256sum >/dev/null 2>&1; then sum() { sha256sum "$1" | cut -d' ' -f1; }
else sum() { shasum -a 256 "$1" | cut -d' ' -f1; }; fi

ADD=""; REPLACE=""; EDITED=""; REMOVE=""; SAME=0
while IFS=' ' read -r kind original path; do
  [ -n "$kind" ] || continue
  case "$path" in
    .env|*/.env|.env.local|*/.env.local|*.env.*local) stop "The update list contains an environment file ($path). Refusing." ;;
  esac
  case "$kind" in
    A|M)
      [ -f "$SRC/$path" ] || stop "The update is incomplete: $path is missing from the unzipped folder."
      if [ ! -e "$TARGET/$path" ]; then ADD="$ADD$path"$'\n'
      elif cmp -s "$SRC/$path" "$TARGET/$path"; then SAME=$((SAME+1))
      else
        REPLACE="$REPLACE$path"$'\n'
        # Different from the version that was uploaded -> you (or a teammate) changed it since.
        if [ "$kind" = "A" ] || [ "$(sum "$TARGET/$path")" != "$original" ]; then EDITED="$EDITED$path"$'\n'; fi
      fi ;;
    D)
      if [ -e "$TARGET/$path" ]; then
        REMOVE="$REMOVE$path"$'\n'
        [ "$(sum "$TARGET/$path")" = "$original" ] || EDITED="$EDITED$path"$'\n'
      fi ;;
  esac
done < "$LIST"

count() { printf '%s' "$1" | grep -c . || true; }
show()  { printf '%s' "$1" | sed 's/^/    /'; }

say ""
say "New files ($(count "$ADD")):";                 show "$ADD"
say "Files to replace ($(count "$REPLACE")):";      show "$REPLACE"
say "Old files to remove ($(count "$REMOVE")):";    show "$REMOVE"
say "Already up to date: $SAME"
if [ -n "$EDITED" ]; then
  say ""
  say "WARNING: these files differ from the version in the ZIP you uploaded, so someone edited them since."
  say "They will still be backed up before being replaced or removed, but check the backup afterwards:"
  show "$EDITED"
fi
DIRTY="$(git -C "$TARGET" status --porcelain | head -20)"
if [ -n "$DIRTY" ]; then
  say ""
  say "Note: this branch has uncommitted changes already (first 20 shown). Committing them first makes undo easier."
  printf '%s\n' "$DIRTY" | sed 's/^/    /'
fi
say ""
say "Not touched: .env files, node_modules, .venv, .next, anything not listed above."

if [ -z "$ADD$REPLACE$REMOVE" ]; then say "Nothing to do. The repository already has this update."; exit 0; fi
if [ "$MODE" = "--dry-run" ]; then say "Dry run only. Nothing was changed."; exit 0; fi

BACKUP="$(dirname "$TARGET")/rockit-backup-$(date +%Y%m%d-%H%M%S)"
say "Backup folder for replaced and removed files: $BACKUP"
printf "Apply these changes to branch '%s'? Type yes to continue: " "$BRANCH"
read -r ANSWER
[ "$ANSWER" = "yes" ] || { say "Nothing was changed."; exit 0; }

mkdir -p "$BACKUP"
printf '%s%s' "$REPLACE" "$REMOVE" | while IFS= read -r path; do
  [ -n "$path" ] || continue
  mkdir -p "$BACKUP/$(dirname "$path")"
  cp -p "$TARGET/$path" "$BACKUP/$path"
done
printf '%s%s' "$ADD" "$REPLACE" | while IFS= read -r path; do
  [ -n "$path" ] || continue
  mkdir -p "$TARGET/$(dirname "$path")"
  cp "$SRC/$path" "$TARGET/$path"
done
printf '%s' "$REMOVE" | while IFS= read -r path; do
  [ -n "$path" ] || continue
  rm -f "$TARGET/$path"
done

say ""
say "Done. Nothing was committed."
say "Next:"
say "  cd \"$TARGET/api\"    && pip install -r requirements.txt && python -m pytest -q"
say "  cd \"$TARGET/rockit\" && npm install && npm run dev"
say "Review with:  git -C \"$TARGET\" status"
say "Undo everything:  git -C \"$TARGET\" restore . && git -C \"$TARGET\" clean -fd api rockit   (or copy files back from $BACKUP)"
