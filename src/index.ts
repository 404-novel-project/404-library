import { readHtmlFile, copyFolderSub } from "./lib.ts";
import { index } from "./template.ts";
import { emptyDirSync } from "fs_mod";
import { copy } from "fs_copy";
import { join } from "path_mod";

interface BookMeta {
  bookname: string;
  author: string;
  href: string;
}
async function getBookMeta(path: string): Promise<null | BookMeta> {
  const _items = Deno.readDirSync(path);
  const items = [..._items];
  const filenames = items
    .filter((item) => item.isFile)
    .map((item) => item.name);
  const testList = ["index.html", "book.json", "chapters.json"];
  for (const t of testList) {
    if (filenames.includes(t) === false) {
      return null;
    }
  }
  try {
    await readHtmlFile(join(path, "index.html"));
    const _chapters = await Deno.readTextFile(join(path, "chapters.json"));
    JSON.parse(_chapters);
    const _book = await Deno.readTextFile(join(path, "book.json"));
    const book = JSON.parse(_book);
    let href = path.replace(Deno.cwd(), "");
    if (!href.endsWith("/")) {
      href = href + "/";
    }
    return {
      bookname: book.bookname,
      author: book.author,
      href,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}
async function getBookMetas(): Promise<BookMeta[]> {
  const BooksDir = join(Deno.cwd(), "books");
  const _items = Deno.readDirSync(BooksDir);
  const items = [..._items];
  const _bookMetas = items
    .filter((item) => item.isDirectory)
    .map((item) => join(BooksDir, item.name))
    .map((path) => getBookMeta(path));
  const bookMetas = (await Promise.all(_bookMetas)).filter(
    (meta) => meta !== null
  ) as BookMeta[];
  return bookMetas;
}
function getIndexPage(books: BookMeta[]) {
  const indexHtml = index.render({ books });
  return indexHtml;
}

const DistDir = join(Deno.cwd(), "dist");
function createDistDir() {
  emptyDirSync(DistDir);
}
async function copyBooks(href: string) {
  const srcDir = join(Deno.cwd(), href);
  const destDir = join(DistDir, href);
  await copy(srcDir, destDir);
  const indexDom = await readHtmlFile(join(srcDir, "index.html"));
  const script = indexDom?.createElement("script");
  script?.setAttribute("src", "/assets/worker.js");
  if (script) {
    indexDom?.head.appendChild(script);
    const indexHTML = indexDom?.documentElement?.outerHTML;
    if (indexHTML) {
      await Deno.writeTextFile(join(destDir, "index.html"), indexHTML);
    }
  }
}
async function createIndexPageAndCopyBooks() {
  const books = await getBookMetas();

  for (const book of books) {
    copyBooks(book.href);
  }

  const indexHtml = await getIndexPage(books);
  const indexPath = join(DistDir, "index.html");
  await Deno.writeTextFile(indexPath, indexHtml);
}
function copyFiles() {
  copy(join(Deno.cwd(), "assets"), join(DistDir, "assets"));
  copyFolderSub(join(Deno.cwd(), "files"), DistDir);
}
export function main() {
  createDistDir();
  createIndexPageAndCopyBooks();
  copyFiles();
}

if (import.meta.main) {
  main();
}
