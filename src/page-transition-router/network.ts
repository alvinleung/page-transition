const cache = {};
export async function loadPageAndCache(target: string) {
  if (cache[target]) {
    return cache[target];
  }
  try {
    const response = await fetch(target);
    const responseText = await response.text();
    cache[target] = responseText;
    return responseText;
    // process the route text
  } catch (e) {
    // fail to fetch url
  }
  return false;
}
function routeToRelativeUrl(route: string) {
  return route;
}

export async function loadHTML(routeString: string) {
  const target = routeToRelativeUrl(routeString);
  return await loadPageAndCache(target);
}
