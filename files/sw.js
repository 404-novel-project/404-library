/// <reference lib="webworker" />
/// <reference lib="webworker.importscripts" />

const version = "v7";

function pathReplace(pathname, replaceValue) {
  return pathname.replace(/\/[\w\.\-%]+$/, `/${replaceValue}`);
}

async function cleanCache() {
  const keys = await caches.keys();
  for (const key of keys) {
    if (!key.endsWith(`-${version}`)) {
      console.log(`Delete cache ${key}`);
      await caches.delete(key);
    }
  }
}
async function initCache() {
  const cacheList = [
    "/assets/chevron-left.svg",
    "/assets/chevron-right.svg",
    "/assets/chevron-up.svg",
    "/assets/worker.js",
    "/favicon.ico",
  ];
  const cache = await caches.open(`main-${version}`);
  cache.addAll(cacheList);
}
async function updateCache() {
  await cleanCache();
  await initCache();
}
self.addEventListener("activate", (event) => {
  event.waitUntil(updateCache());
});

async function getSibling(chapterNumber, pathname) {
  const path = pathReplace(pathname, "chapters.json");

  const request = new Request(path);
  let response;
  const cache = await caches.open(`chapters-json-${version}`);
  const cacheResponse = await cache.match(request);
  if (cacheResponse) {
    console.log(`Found cache: ${request.url}`);
    response = cacheResponse;
  } else {
    response = await fetch(request);
    cache.put(request, response.clone());
  }

  try {
    const chapters = await response.clone().json();
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
function getAppendContent(previous, next, pathname) {
  let domText = '<div class="nav">';
  if (previous) {
    domText = domText +
      `<a href="${
        pathReplace(
          pathname,
          previous.chapterHtmlFileName,
        )
      }" class="left"><img src="/assets/chevron-left.svg" /></a>`;
  } else {
    domText = domText +
      `<a class="disabled left"><img src="/assets/chevron-left.svg" /></a>`;
  }
  domText = domText +
    `<a href="${
      pathReplace(
        pathname,
        "",
      )
    }" class="up"><img src="/assets/chevron-up.svg"></a>`;
  if (next) {
    domText = domText +
      `<a href="${
        pathReplace(
          pathname,
          next.chapterHtmlFileName,
        )
      }" class="right"><img src="/assets/chevron-right.svg"></a>`;
  } else {
    domText = domText +
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

  // prefetch next page
  Array.from(
    document.querySelectorAll(".nav > a.right[href], .nav > a.left[href]")
  ).forEach((a) => fetch(a.href));  
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
  const chapterNumber = /\/([a-zA-Z]+)?(\d+)([a-zA-Z\.]+)?$/.exec(
    pathname,
  )?.map((m) => parseInt(m, 10)).filter((p) => !isNaN(p))[0];
  if (chapterNumber !== undefined) {
    const { previous, next } = await getSibling(chapterNumber, pathname);
    text = text.replace(
      "</body>",
      getAppendContent(previous, next, pathname) + "</body>",
    );
    return text;
  } else {
    return text;
  }
}
async function handleRequest(event) {
  const cache = await caches.open(`main-${version}`);
  const cacheResponse = await cache.match(event.request);
  if (cacheResponse) {
    console.log(`Found cache: ${event.request.url}`);
    return cacheResponse;
  }

  const resp = await fetch(event.request);
  const pathname = new URL(resp.url).pathname;
  if (
    /^\/books\/[\[\](%5B)(%5D)\-\w]+\/(\w+)?(Chapter)([\w\.]+)?$/.test(pathname)
  ) {
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
      cache.put(event.request, response.clone());
      return response.clone();
    } else {
      if (resp.clone().status !== 404) {
        cache.put(event.request, resp.clone());
      }
      return resp.clone();
    }
  } else {
    if (resp.clone().status !== 404) {
      cache.put(event.request, resp.clone());
    }
    return resp.clone();
  }
}
self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});
