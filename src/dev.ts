import { debounce } from "./lib.ts";
import { join } from "path_mod";

const kinds = ["create", "modify", "remove"];
const ignoreList = [
  "deps",
  "gen",
  "registries",
  "dist",
  ".git",
  ".gitignore",
  ".vscode",
];
function inIgnoreList(paths: string[]) {
  const _ignoreList = ignoreList.map((p) => join(Deno.cwd(), p));
  return paths.every((p) => _ignoreList.some((i) => p.startsWith(i)));
}
function build() {
  Deno.run({
    cmd: [
      "deno",
      "run",
      "--import-map",
      "./import_map.json",
      "--allow-read",
      "--allow-write",
      "--unstable",
      "./src/index.ts",
    ],
  });
}
const buildDebounce = debounce(() => {
  console.log("Rebuild……");
  build();
}, 1500);

function server() {
  build();
  Deno.run({
    cmd: [
      "deno",
      "run",
      "--allow-net",
      "--allow-read",
      "https://deno.land/std/http/file_server.ts",
      join(Deno.cwd(), "dist"),
    ],
  });
}

async function watch() {
  const watcher = Deno.watchFs(Deno.cwd());
  for await (const event of watcher) {
    if (kinds.includes(event.kind)) {
      if (!inIgnoreList(event.paths)) {
        buildDebounce();
      }
    }
  }
}

async function main() {
  server();
  await watch();
}

if (import.meta.main) {
  main();
}
