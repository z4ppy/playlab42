#!/usr/bin/env bash
set -euo pipefail

# Vérifier l'archive avant toute extraction ; aucun paquet système ni « latest ».
case "${1:-}" in
  gitleaks)
    version=8.30.1
    archive="gitleaks_${version}_linux_x64.tar.gz"
    url="https://github.com/gitleaks/gitleaks/releases/download/v${version}/${archive}"
    checksum=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
    ;;
  trivy)
    version=0.75.0
    archive="trivy_${version}_Linux-64bit.tar.gz"
    url="https://github.com/aquasecurity/trivy/releases/download/v${version}/${archive}"
    checksum=c6e65abddb348e25f10549df887045629cf28cc72453cd1c63acb717316b3f3f
    ;;
  *)
    echo "Usage: $0 {gitleaks|trivy}" >&2
    exit 2
    ;;
esac

: "${RUNNER_TEMP:?RUNNER_TEMP requis}"
: "${GITHUB_PATH:?GITHUB_PATH requis}"
install_dir="$RUNNER_TEMP/security-scanners/$1"
mkdir -p "$install_dir"
curl --fail --silent --show-error --location "$url" --output "$install_dir/$archive"
printf '%s  %s\n' "$checksum" "$install_dir/$archive" | sha256sum -c
tar -xzf "$install_dir/$archive" -C "$install_dir" "$1"
"$install_dir/$1" --version
printf '%s\n' "$install_dir" >> "$GITHUB_PATH"
