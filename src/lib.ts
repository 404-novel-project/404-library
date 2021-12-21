import { DOMParser } from "deno_dom";
import { copy } from "fs_copy";
import { join } from "path_mod";

export async function readHtmlFile(path: string) {
  const text = await Deno.readTextFile(path);
  return new DOMParser().parseFromString(text, "text/html");
}

export async function copyFolderSub(src: string, dest: string) {
  const items = [...Deno.readDirSync(src)];
  const tasks = items.map((item) =>
    copy(join(src, item.name), join(dest, item.name))
  );
  await Promise.all(tasks);
}

// https://segmentfault.com/a/1190000018428170
// deno-lint-ignore no-explicit-any
export function debounce(fn: (...args: any[]) => any, delay: number) {
  let timer: number | null = null;
  return function () {
    if (timer) {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    } else {
      timer = setTimeout(fn, delay);
    }
  };
}
