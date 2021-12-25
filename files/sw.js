/// <reference lib="webworker" />
/// <reference lib="webworker.importscripts" />

const version = "v10";
let Status;
(function (Status) {
  Status[(Status["pending"] = 0)] = "pending";
  Status[(Status["downloading"] = 1)] = "downloading";
  Status[(Status["failed"] = 2)] = "failed";
  Status[(Status["finished"] = 3)] = "finished";
  Status[(Status["aborted"] = 4)] = "aborted";
  Status[(Status["saved"] = 5)] = "saved";
})(Status || (Status = {}));

function pathReplace(pathname, replaceValue) {
  return pathname.substring(0, pathname.lastIndexOf("/") + 1) + replaceValue;
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
    "/assets/nav.css",
    "/favicon.ico",
    "/404.html",
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

  const chapterNumberSort = (a, b) => {
    return a.chapterNumber - b.chapterNumber;
  };
  const chapterStatusFilter = (c) => {
    if (c.status !== undefined) {
      const ignoreList = [
        Status.pending,
        Status.downloading,
        Status.failed,
        Status.aborted,
      ];
      return !ignoreList.includes(c.status);
    } else {
      return true;
    }
  };
  const chapters = await response.clone().json();
  const previousList = chapters
    .filter(chapterStatusFilter)
    .filter((c) => c.chapterNumber < chapterNumber)
    .sort(chapterNumberSort);
  const nextList = chapters
    .filter(chapterStatusFilter)
    .filter((c) => c.chapterNumber > chapterNumber)
    .sort(chapterNumberSort);
  return {
    previous: previousList.slice(-1)[0] ?? null,
    next: nextList[0] ?? null,
  };
}
function getChapterJS(previous, next, pathname) {
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

  const js = `const main = document.querySelector(".main");
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
).forEach((a) => fetch(a.href));`;
  return js;
}
async function chapterJS(request) {
  const cache = await caches.open(`chapters-js-${version}`);
  const cacheResponse = await cache.match(request);
  if (cacheResponse) {
    console.log(`Found cache: ${request.url}`);
    return cacheResponse;
  }

  const pathname = new URL(request.url).pathname;
  const chapterNumber = /\d+/
    .exec(pathname.substring(pathname.lastIndexOf("/") + 1))
    ?.map((n) => parseInt(n))[0];
  if (chapterNumber !== undefined) {
    const { previous, next } = await getSibling(chapterNumber, pathname);
    const js = getChapterJS(previous, next, pathname);
    const body = new Blob([js], {
      type: "text/javascript; charset=UTF-8",
    });
    const response = new Response(body, {
      status: 200,
    });
    cache.put(request, response.clone());
    return response;
  } else {
    const resp = await fetch("/404.html");
    return new Response(resp.body, {
      status: 404,
      headers: resp.headers,
    });
  }
}

function modifyHTMLText(text, pathname) {
  const chapterNumber = /\d+/
    .exec(pathname.substring(pathname.lastIndexOf("/") + 1))
    ?.map((n) => parseInt(n))[0];
  if (chapterNumber !== undefined) {
    text = text.replace(
      "</head>",
      '<link href="/assets/nav.css" type="text/css" rel="stylesheet" /></head>'
    );
    text = text.replace(
      "</body>",
      `<script src="Chapter${chapterNumber}.js"></script></body>`
    );
    return text;
  } else {
    return text;
  }
}
async function modifyHTMLRequest(req, resp, cache) {
  const { pathname } = new URL(req.url);

  const _text = await resp.text();
  const text = modifyHTMLText(_text, pathname);
  const body = new Blob([text], {
    type: "text/html; charset=UTF-8",
  });
  const response = new Response(body, {
    headers: resp.headers,
    status: resp.status,
    statusText: resp.statusText,
  });
  cache.put(req, response.clone());
  return response;
}

function cacheRequest(request, response, cache) {
  if (response.clone().status >= 200 && response.clone().status < 400) {
    cache.put(request, response.clone());
  }
}
async function handleRequest(event) {
  const { origin, pathname } = new URL(event.request.url);
  // JS文件
  if (
    origin === self.location.origin &&
    /^\/books\/[\[\](%5B)(%5D)\-\w]+\/Chapter\d+\.js$/.test(pathname)
  ) {
    return chapterJS(event.request);
  }

  const cache = await caches.open(`main-${version}`);
  const cacheResponse = await cache.match(event.request);
  if (cacheResponse) {
    console.log(`Found cache: ${event.request.url}`);
    return cacheResponse;
  }

  const resp = await fetch(event.request);
  // 修改HTML文件
  if (
    origin === self.location.origin &&
    /^\/books\/[\[\](%5B)(%5D)\-\w]+\/(\w+)?(Chapter)([\w\.]+)?$/.test(pathname)
  ) {
    if (resp.ok) {
      return modifyHTMLRequest(event.request, resp, cache);
    } else {
      cacheRequest(event.request, resp, cache);
      return resp;
    }
  }

  cacheRequest(event.request, resp, cache);
  return resp;
}
self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});
