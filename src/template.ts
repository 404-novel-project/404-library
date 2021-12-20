import { Environment, Template } from "nunjucks";
import { readFileSync } from "./lib.ts";

const env = new Environment(undefined, { autoescape: true });
const indexHtmlJ2 = readFileSync(`${Deno.cwd()}/src/index.html.j2`);
export const index = new Template(indexHtmlJ2, env, undefined, true);
