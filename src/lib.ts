import { DOMParser } from "deno_dom";
import { copy } from "fs_copy";
import { join } from "path_mod";

export function readFileSync(path: string, charset?: string) {
  if (charset === undefined) {
    charset = "utf-8";
  }
  const data = Deno.readFileSync(path);
  const decoder = new TextDecoder(charset);
  const text = decoder.decode(data);
  return text;
}

export async function readFile(path: string, charset?: string) {
  if (charset === undefined) {
    charset = "utf-8";
  }
  const data = await Deno.readFile(path);
  const decoder = new TextDecoder(charset);
  const text = decoder.decode(data);
  return text;
}

export async function readHtmlFile(path: string, charset?: string) {
  const text = await readFile(path, charset);
  return new DOMParser().parseFromString(text, "text/html");
}

export async function createFile(path: string, text: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const f = await Deno.open(path, { createNew: true, write: true, read: true });
  await f.write(data);
  f.close();
}

export async function writeFile(path: string, text: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const f = await Deno.open(path, { write: true, read: true });
  await f.write(data);
  f.close();
}

export function copyFolderSub(src: string, dest: string) {
  const _items = Deno.readDirSync(src);
  const items = [..._items];
  for (const item of items) {
    copy(join(src, item.name), join(dest, item.name));
  }
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
