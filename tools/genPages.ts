import { Environment, Template } from "nunjucks";
import { join } from "path_mod";
import { parse } from "flags";
import { copy } from "fs_copy";
import { BookJsonLite, chapterJsonLite } from "./genMetaJson.ts";
import { readHtmlFile } from "../src/lib.ts";

const sDir = import.meta.url
  .replace("file://", "")
  .replace(/\/[\w\.]+$/, "/");

async function genTocCss(
  path: string,
  book: BookJsonLite,
) {
  const tocPath = join(sDir, "toc.css");
  let tocStyleText = await Deno.readTextFile(tocPath);

  if (book.additionalMetadate.cover?.name) {
    tocStyleText = `${tocStyleText}
    .info {
        display: grid;
        grid-template-columns: 30% 70%;
    }`;
  } else {
    tocStyleText = `${tocStyleText}
    .info {
        display: grid;
        grid-template-columns: 100%;
    }`;
  }
  await Deno.writeTextFile(join(path, "toc.css"), tocStyleText);
  try {
    await copy(join(sDir, "style.css"), join(path, "style.css"));
  } catch (error) {
    await Deno.remove(join(path, "style.css"));
    await copy(join(sDir, "style.css"), join(path, "style.css"));
  }
}

interface SectionObj {
  sectionName: string | null;
  sectionNumber: number | null;
  chpaters: chapterJsonLite[];
}
interface SectionsObj {
  [sectionNumber: number]: SectionObj;
}
function getSectionsObj(chapters: chapterJsonLite[]): SectionObj[] {
  const _sectionsObj: SectionsObj = {};
  for (const chapter of chapters) {
    let sectionNumber: number | null = null;
    const sectionName: string | null = null;
    if (chapter.sectionNumber && chapter.sectionName) {
      sectionNumber = chapter.sectionNumber;
    } else {
      sectionNumber = -99999999;
    }

    if (_sectionsObj[sectionNumber]) {
      _sectionsObj[sectionNumber].chpaters.push(chapter);
    } else {
      _sectionsObj[sectionNumber] = {
        sectionName: chapter.sectionName,
        sectionNumber: chapter.sectionNumber,
        chpaters: [chapter],
      };
    }
  }
  const _sectionsListObj: [string, SectionObj][] = Object.entries(_sectionsObj);
  function sectionListSort(a: [string, SectionObj], b: [string, SectionObj]) {
    const aKey = Number(a[0]);
    const bKey = Number(b[0]);
    return aKey - bKey;
  }
  _sectionsListObj.sort(sectionListSort);
  const sectionsListObj = _sectionsListObj.map((s) => s[1]);
  return sectionsListObj;
}
async function genIndex(
  path: string,
  book: BookJsonLite,
  chapters: chapterJsonLite[],
) {
  const env = new Environment(undefined, { autoescape: true });
  const indexHtmlJ2 = await Deno.readTextFile(
    join(sDir, "index.html.j2"),
  );
  const index = new Template(indexHtmlJ2, env, undefined, true);

  const sectionsListObj = getSectionsObj(chapters);
  const indexHtmlText = index.render({
    creationDate: Date.now(),
    bookname: book.bookname,
    author: book.author,
    cover: book.additionalMetadate.cover,
    introduction: book.introduction,
    bookUrl: book.bookUrl,
    sectionsObj: Object.values(sectionsListObj),
  });
  await Deno.writeTextFile(join(path, "index.html"), indexHtmlText);
}

async function genChapterPage(
  path: string,
  chapter: chapterJsonLite,
  templt: any,
) {
  const doc = await readHtmlFile(path);
  if (doc) {
    const div = doc.querySelector("body > div:nth-child(2)");
    if (div) {
      const htmlText = templt.render({
        chapterUrl: chapter.chapterUrl,
        chapterName: chapter.chapterName,
        outerHTML: div.outerHTML,
      });
      console.log(path);
      await Deno.writeTextFile(path, htmlText);
    }
  }
}
async function genChapterPages(path: string, chapters: chapterJsonLite[]) {
  const env = new Environment(undefined, { autoescape: false });
  const chapterHtmlJ2 = await Deno.readTextFile(
    join(sDir, "chapter.html.j2"),
  );
  const chapterTemplt = new Template(chapterHtmlJ2, env, undefined, true);

  const tasks = chapters.map((chapter) => {
    const chapterPath = join(path, chapter.chapterHtmlFileName);
    return genChapterPage(chapterPath, chapter, chapterTemplt);
  });
  await Promise.all(tasks);
}

async function main() {
  const args = parse(Deno.args, {
    string: ["folder"],
  });
  const folder = args["_"][0] as string;
  const path = join(Deno.cwd(), folder);
  console.log(path);

  const _book = await Deno.readTextFile(join(path, "book.json"));
  const book = JSON.parse(_book) as BookJsonLite;
  const _chapters = await Deno.readTextFile(join(path, "chapters.json"));
  const chapters = JSON.parse(_chapters) as chapterJsonLite[];

  await genTocCss(path, book);
  await genIndex(path, book, chapters);
  await genChapterPages(path, chapters);
}

if (import.meta.main) {
  main();
}
