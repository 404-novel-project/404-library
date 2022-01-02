import { copyFolderSub, readHtmlFile } from "./lib.ts";
import { Environment, Template } from "nunjucks";
import { pinyin } from "pinyinPro";
import { emptyDirSync } from "fs_mod";
import { copy } from "fs_copy";
import { join } from "path_mod";

const DistDir = join(Deno.cwd(), "dist");
const baseHost = "404.bgme.bid";

interface BookMeta {
  bookname: string;
  author: string;
  href: string;
  destHref: string;
  urlIndex: string;
  urlSitemap: string;
}
function converHref(href: string) {
  const pinyinArray =
    (pinyin(href, { toneType: "none", type: "array" }) as string[]);
  const newHref = pinyinArray
    .join("-")
    .replace(/(\-+)?\[(\-+)?/, "[")
    .replace(/(\-+)?\](\-+)?/, "]")
    .replace(/(\-+)?\/$/, "/")
    .replaceAll("ü", "v");
  if (/^[\w\/\.\-\[\]]+$/.test(newHref)) {
    return newHref;
  } else {
    console.error(href, newHref);
    throw new Error("href convert failed!");
  }
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
  await readHtmlFile(join(path, "index.html"));
  const _chapters = await Deno.readTextFile(join(path, "chapters.json"));
  JSON.parse(_chapters);
  const _book = await Deno.readTextFile(join(path, "book.json"));
  const book = JSON.parse(_book);
  let href = path.replace(Deno.cwd(), "");
  if (!href.endsWith("/")) {
    href = href + "/";
  }
  const destHref = converHref(href);
  return {
    bookname: book.bookname,
    author: book.author,
    href,
    destHref,
    urlIndex: encodeURI(destHref),
    urlSitemap: "https://" + join(baseHost, encodeURI(destHref)),
  };
}
async function getBookMetas(): Promise<BookMeta[]> {
  const BooksDir = join(Deno.cwd(), "books");
  const _items = Deno.readDirSync(BooksDir);
  const items = [..._items];
  const _bookMetas = items
    .filter((item) => item.isDirectory)
    .map((item) => join(BooksDir, item.name))
    .map((path) => getBookMeta(path));
  const bookMetas = ((await Promise.all(_bookMetas))
    .filter((meta) => meta !== null) as BookMeta[])
    .sort((a, b) => {
      if (a.bookname > b.bookname) {
        return 1;
      }
      if (a.bookname < b.bookname) {
        return -1;
      }
      return 0;
    });
  return bookMetas;
}
async function genIndexPage(books: BookMeta[]) {
  const env = new Environment(undefined, { autoescape: true });
  const indexHtmlJ2 = await Deno.readTextFile(
    join(Deno.cwd(), "src", "index.html.j2"),
  );
  const index = new Template(indexHtmlJ2, env, undefined, true);

  const indexHtml = index.render({ books });
  const indexPath = join(DistDir, "index.html");
  await Deno.writeTextFile(indexPath, indexHtml);
}

async function genSitemaps(books: BookMeta[]) {
  const env = new Environment(undefined, { autoescape: true });
  const siteMapJ2 = await Deno.readTextFile(
    join(Deno.cwd(), "src", "sitemaps.xml.j2"),
  );
  const siteMap = new Template(siteMapJ2, env, undefined, true);

  const siteMapXML = siteMap.render({ books });
  const siteMapPath = join(DistDir, "sitemapindex.xml");
  await Deno.writeTextFile(siteMapPath, siteMapXML);
}

function createDistDir() {
  emptyDirSync(DistDir);
}
async function copyBooks(href: string, destHref: string) {
  const srcDir = join(Deno.cwd(), href);
  const destDir = join(DistDir, destHref);
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

  const tasks = books.map((book) => copyBooks(book.href, book.destHref));
  await Promise.all(tasks);

  await genIndexPage(books);
  await genSitemaps(books);
}
async function copyFiles() {
  await copy(join(Deno.cwd(), "assets"), join(DistDir, "assets"));
  await copyFolderSub(join(Deno.cwd(), "files"), DistDir);
}
async function main() {
  createDistDir();
  await createIndexPageAndCopyBooks();
  await copyFiles();
}

if (import.meta.main) {
  console.log("Start……");
  main()
    .then(() => {
      console.log("finished!");
      Deno.exit(0);
    })
    .catch((error) => {
      console.error(error);
      Deno.exit(1);
    });
}
