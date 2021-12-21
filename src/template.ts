import { Environment, Template } from "nunjucks";
import { join } from "path_mod";

const env = new Environment(undefined, { autoescape: true });
const indexHtmlJ2 = Deno.readTextFileSync(
  join(Deno.cwd(), "src", "index.html.j2")
);
export const index = new Template(indexHtmlJ2, env, undefined, true);
