#!/bin/bash

echo $PWD

if [ "$#" == "0" ]; then
deno cache --import-map="./import_map.json" --reload --lock=lock.json --unstable src/index.ts
fi

if [ "$#" == "1" ] && [ "$1" == "--update" ]; then
deno cache --import-map="./import_map.json" --lock=lock.json --lock-write --unstable src/index.ts
fi