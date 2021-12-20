#!/bin/bash

deno run --import-map="./import_map.json" --allow-read --allow-write --unstable src/index.ts