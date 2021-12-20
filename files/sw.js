function pathReplace(pathname, replaceValue) {
  return pathname.replace(/\/\w+\.html$/, `/${replaceValue}`);
}

async function getSibling(chapterNumber, pathname) {
  const path = pathReplace(pathname, "chapters.json");
  const resp = await fetch(path);
  try {
    const chapters = await resp.json();
    const previousList = chapters
      .filter((c) => c.chapterNumber < chapterNumber)
      .sort(chapterNumberSort);
    const nextList = chapters
      .filter((c) => c.chapterNumber > chapterNumber)
      .sort(chapterNumberSort);
    return {
      previous: previousList.slice(-1)[0] ?? null,
      next: nextList[0] ?? null,
    };
  } catch (error) {
    console.error(error);
    return {
      previous: null,
      next: null,
    };
  }

  function chapterNumberSort(a, b) {
    return a.chapterNumber - b.chapterNumber;
  }
}
function getNav(previous, next, pathname) {
  let domText = '<div class="nav">';
  if (previous) {
    domText =
      domText +
      `<a href="${pathReplace(
        pathname,
        previous.chapterHtmlFileName
      )}" class="left"><img src="/assets/chevron-left.svg" /></a>`;
  } else {
    domText =
      domText +
      `<a class="disabled left"><img src="/assets/chevron-left.svg" /></a>`;
  }
  domText =
    domText +
    `<a href="${pathReplace(
      pathname,
      ""
    )}" class="up"><img src="/assets/chevron-up.svg"></a>`;
  if (next) {
    domText =
      domText +
      `<a href="${pathReplace(
        pathname,
        next.chapterHtmlFileName
      )}" class="right"><img src="/assets/chevron-right.svg"></a>`;
  } else {
    domText =
      domText +
      `<a class="disabled right"><img src="/assets/chevron-right.svg"></a>`;
  }
  domText = domText + `</div>`;

  const appendContent = `
<script>
  const main = document.querySelector(".main");
  main.innerHTML = main.innerHTML + \`${domText}\`;
  document.addEventListener("keydown", (e) => {
    const key = e.keyCode;
    // enter
    if (key === 13) {
        document.querySelector(".nav > a.up")?.click()
    }
    // left arrow
    if (key === 37) {
        document.querySelector(".nav > a.left")?.click()
    }
    // right arrow
    if (key === 39) {
        document.querySelector(".nav > a.right")?.click()
    }
  });
</script>
<style>
  .nav {
    display: grid;
    grid-template-columns: 33% 33% 33%;
    margin-top: 1.5em;
  }
  .nav > a {
    text-align: center;
  }
  .nav > a.disabled {
    pointer-events: none;
    cursor: default;
  }
</style>
`;
  return appendContent;
}
async function modify(text, pathname) {
  const _chapterNumber = /\/[a-zA-Z]+(\d+)[a-zA-Z]+\.html$/
    .exec(pathname)
    ?.slice(-1)[0];
  if (_chapterNumber) {
    const chapterNumber = parseInt(_chapterNumber, 10);
    const { previous, next } = await getSibling(chapterNumber, pathname);
    text = text.replace(
      "</html>",
      getNav(previous, next, pathname) + "</html>"
    );
    return text;
  } else {
    return text;
  }
}

self.addEventListener("fetch", (event) => {
  const handler = async () => {
    const resp = await fetch(event.request);
    const pathname = new URL(resp.url).pathname;
    if (/^\/books\/.+\/\w+\.html$/.test(pathname)) {
      if (resp.ok) {
        const text = await resp.text();
        const newText = await modify(text, pathname);
        const body = new Blob([newText], {
          type: "text/html; charset=UTF-8",
        });
        const response = new Response(body, {
          headers: resp.headers,
          status: resp.status,
          statusText: resp.statusText,
        });
        return response;
      } else {
        return resp;
      }
    } else {
      return resp;
    }
  };
  event.respondWith(handler());
});
