#!/bin/bash
set -e

NAME=millegrilles_authentication_typescript
BRANCH=`git rev-parse --abbrev-ref HEAD`
BUILD='DEV'
VERSION=$BRANCH.$BUILD

echo "Build name: $NAME"

build_app() {
  REP_CLIENT=$1
  REP_STATIC=$2

  rm -rf $REP_CLIENT/build
  rm -rf $REP_STATIC

  makeManifest $REP_CLIENT

  echo "Installer toutes les dependances"
  cd $REP_CLIENT
  npm i

  echo "Build React"
  npm run build

  echo "Copier le build React vers $REP_STATIC"
  mkdir -p $REP_STATIC
  cp -r ./build/* $REP_STATIC
}

build_react() {
  echo "Build application React (/millegrilles)"
  NOM_APP=$1

  mkdir -p $REP_STATIC_GLOBAL/$NOM_APP

  REP_COMPTES_SRC="$REP_COURANT"
  build_app $REP_COMPTES_SRC $REP_STATIC_GLOBAL/$NOM_APP

  # Compresser tous les fichiers ressources en gzip (et conserver l'original)
  FICHIERS_GZ=`find $REP_STATIC_GLOBAL/$NOM_APP -type f \( -name "*.js" -o -name "*.css" -o -name "*.map" -o -name "*.json" \)`
  for FICHIER in ${FICHIERS_GZ[@]}; do gzip -k $FICHIER; done

  cd $REP_STATIC_GLOBAL
  tar -zcf ../$BUILD_FILE $NOM_APP
}

makeManifest() {
  PATH_APP=$1
  PATH_MANIFEST=$PATH_APP/src/manifest.build.json

  VERSION='DEV'
  DATECOURANTE=`date "+%Y-%m-%d %H:%M"`

  echo "{" > $PATH_MANIFEST
  echo "  \"date\": \"$DATECOURANTE\"," >> $PATH_MANIFEST
  echo "  \"version\": \"$VERSION\"" >> $PATH_MANIFEST
  echo "}" >> $PATH_MANIFEST

  echo "Manifest $PATH_MANIFEST"
  cat $PATH_MANIFEST
}

REP_COURANT=`pwd`
REP_STATIC_GLOBAL=${REP_COURANT}/static
BUILD_FILE="${NAME}.${VERSION}.tar.gz"
BUILD_PATH="git/millegrilles.authentication.typescript"

build_react millegrilles
