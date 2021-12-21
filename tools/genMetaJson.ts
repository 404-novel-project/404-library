import { readHtmlFile } from "../src/lib.ts";
import { join } from "path_mod";
import { parse } from "flags";

export interface BookJsonLite {
  bookUrl: string;
  bookname: string;
  author: string;
  introduction: string | null;
  introductionHTML: Record<never, never>;
  additionalMetadate: {
    cover?: {
      url?: string;
      name: string;
    };
  };
}
function getBookJson(path: string): BookJsonLite {
  const infoTxtPath = join(path, "info.txt");
  const text = Deno.readTextFileSync(infoTxtPath);

  const bookname = /题名：(.+)/.exec(text)?.[1] ?? "";
  const author = /作者：(.+)/.exec(text)?.[1] ?? "";
  const bookUrl = /来源：(.+)/.exec(text)?.[1] ?? "";
  const introduction = text
    .replace(/题名：(.+)/, "")
    .replace(/作者：(.+)/, "")
    .replace(/来源：(.+)/, "")
    .replace("简介：", "")
    .trim();
  const getCoverName = (path: string) => {
    const dir = [...Deno.readDirSync(path)];
    const name = dir
      .filter((f) => f.isFile)
      .filter((f) => f.name.includes("cover"))
      .map((f) => f.name)?.[0];
    return name;
  };
  const coverName = getCoverName(path);

  const book = {
    bookname,
    author,
    bookUrl,
    introduction,
    introductionHTML: {},
    additionalMetadate: {
      cover: {
        name: coverName,
      },
    },
  };
  console.log(book);
  return book;
}

export interface chapterJsonLite {
  chapterUrl?: string;
  chapterNumber: number;
  chapterName: string;
  isVIP?: boolean;
  isPaid?: boolean;
  sectionName: string | null;
  sectionNumber: number | null;
  sectionChapterNumber: number | null;
  additionalMetadate: null;
  chapterHtmlFileName: string;
}
async function getChaptersJson(path: string): Promise<chapterJsonLite[]> {
  const dir = [...Deno.readDirSync(path)];
  const chapterDir = dir
    .filter((f) => f.isFile)
    .filter((f) => f.name.includes("Chapter"))
    .filter((f) => !f.name.includes("Stub.html"));

  const getJson = async (cp: string, cn: string) => {
    const doc = await readHtmlFile(cp);
    const chapterName = doc?.querySelector("h2")?.innerText.trim();
    const chapterHtmlFileName = cn;
    const chapterNumber = /(\d+)/.exec(cn)?.[0];
    if (chapterName && chapterHtmlFileName && chapterNumber) {
      return {
        chapterNumber: parseInt(chapterNumber, 10),
        chapterName,
        chapterHtmlFileName,
        sectionName: null,
        sectionNumber: null,
        sectionChapterNumber: null,
        additionalMetadate: null,
      };
    } else {
      throw new Error("parse Chapter Error!");
    }
  };
  const _jsons = chapterDir
    .map((c) => {
      const cn = c.name;
      const cp = join(path, cn);
      return getJson(cp, cn);
    });
  const jsons = await Promise.all(_jsons);
  return jsons;
}

async function main() {
  const args = parse(Deno.args, {
    string: ["folder"],
  });
  const folder = args["_"][0] as string;
  const path = join(Deno.cwd(), folder);
  console.log(path);

  const bookJson = getBookJson(path);
  const bookJsonPath = join(path, "book.json");
  Deno.writeTextFileSync(bookJsonPath, JSON.stringify(bookJson));

  const chaptersJson = await getChaptersJson(path);
  const chaptersJsonPath = join(path, "chapters.json");
  Deno.writeTextFileSync(chaptersJsonPath, JSON.stringify(chaptersJson));
}

if (import.meta.main) {
  main();
}
