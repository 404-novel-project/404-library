#!/bin/bash

deno run --import-map="./import_map.json" --allow-read --allow-write --allow-run --unstable src/dev.ts