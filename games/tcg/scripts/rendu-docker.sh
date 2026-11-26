#!/usr/bin/env sh
# Banc de rendu des cartes en local, dans l'image Playwright du CI (Linux : mêmes polices, même
# rendu que les captures de référence). Docker requis.
#   pnpm test:rendu:docker            compare aux références
#   pnpm test:rendu:docker --update   renouvelle les références (changement de rendu voulu)
# Le dépôt est copié dans le conteneur (sans node_modules) ; seules les captures en reviennent :
# test/rendu/__screenshots__ (références) et test/rendu/.echecs (captures et écarts d'un échec).
set -e
racine=$(git rev-parse --show-toplevel)
pnpm_version=$(node -p "require('$racine/package.json').packageManager.split('@')[1]")
playwright_version=$(node -p "require('$racine/games/tcg/package.json').devDependencies.playwright")

MSYS_NO_PATHCONV=1 docker run --rm --ipc=host --user pwuser \
  -v "$racine":/src:ro \
  -v "$racine/games/tcg/test/rendu":/sortie \
  -v potopia-rendu-pnpm:/home/pwuser/.local/share/pnpm \
  -e CI=1 \
  "mcr.microsoft.com/playwright:v$playwright_version-noble" \
  bash -c '
    set -e
    mkdir -p ~/w && cd ~/w
    tar -C /src --exclude=node_modules --exclude=.next --exclude=.turbo --exclude=.git -cf - . | tar -xf -
    pnpm() { npx --yes "pnpm@'"$pnpm_version"'" "$@"; }
    pnpm install --frozen-lockfile --filter @app/tcg... > /tmp/install.log 2>&1 || { tail -30 /tmp/install.log; exit 1; }
    cd games/tcg
    statut=0
    pnpm test:rendu "$@" || statut=$?
    rm -rf /sortie/.echecs
    [ -d test/rendu/__screenshots__ ] && cp -r test/rendu/__screenshots__ /sortie/
    [ -d .vitest/attachments ] && cp -r .vitest/attachments /sortie/.echecs
    exit $statut
  ' rendu "$@"
