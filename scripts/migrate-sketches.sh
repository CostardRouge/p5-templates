#!/bin/bash

SKETCHES_DIR="../public/assets/scripts/p5-sketches/sketches"

mkdir -p "$SKETCHES_DIR"

for file in "$SKETCHES_DIR"/*.js; do
  [ -e "$file" ] || continue

  filename=$(basename -- "$file")
  name="${filename%.*}"

  mkdir -p "$SKETCHES_DIR/$name"
  mv "$file" "$SKETCHES_DIR/$name/index.js"

  echo "Moved $filename to $name/index.js"
done