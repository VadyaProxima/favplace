#!/usr/bin/env bash
set -euo pipefail
root=/opt/favplace
read -r action revision extra <<< "${SSH_ORIGINAL_COMMAND:-}"
if [[ ! $revision =~ ^[0-9a-f]{40}$ || -n ${extra:-} ]]; then
  echo 'Expected upload or deploy followed by a full commit SHA' >&2
  exit 64
fi
case "$action" in
  upload)
    install -d -m 700 "$root/incoming"
    temporary=$(mktemp "$root/incoming/.upload.XXXXXX")
    trap 'rm -f "$temporary"' EXIT
    cat > "$temporary"
    tar -tzf "$temporary" >/dev/null
    mv "$temporary" "$root/incoming/$revision.tar.gz"
    ;;
  deploy)
    exec /usr/local/sbin/favplace-deploy "$revision"
    ;;
  *)
    echo 'This SSH key permits source upload and deployment only' >&2
    exit 64
    ;;
esac
