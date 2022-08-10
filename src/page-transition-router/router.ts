import { loadPageAndCache } from "./pageCache";
import { state } from "./util";

type RouteChangeHandler = (newRoute: string, prevRoute: string) => void;

interface RouterConfig {
  onLoadRoute?: (target: string) => void;
  onUnloadRoute?: (target: string) => void;
}

export interface Router {
  navigateTo: (newRoute: string) => void;
  observeRouteChange: (routeChangeHandler: RouteChangeHandler) => void;
  unobserveRouteChange: (routeChangeHandler: RouteChangeHandler) => void;
  useScript: (script: () => () => void) => void;
  cleanup: () => void;
}

function routeToRelativeUrl(route: string) {
  return route;
}

/**
 * Intercept Link click
 * @param param0
 * @returns
 */
function interceptLinkClick({ onClick = (link: string) => {} }) {
  const grabAllLinks = () => document.querySelectorAll("a");

  const links = state(
    document.readyState === "interactive" ? grabAllLinks() : undefined
  );

  links.onChange((links, prevLinks) => {
    if (!links) return;

    if (prevLinks) {
      // add remove all previous intercepts
      prevLinks.forEach((link) =>
        link.removeEventListener("click", handleLinkClick)
      );
    }

    // add intercept
    links.forEach((link) => link.addEventListener("click", handleLinkClick));

    // prefetch all links
    links.forEach((link) => loadPageAndCache(link.href));
  });

  // if not, then load it after the document is loaded
  window.addEventListener("DOMContentLoaded", () => {
    links.set(grabAllLinks());
  });

  function handleLinkClick(e: MouseEvent) {
    e.preventDefault();
    onClick((e.target as HTMLAnchorElement).href);
  }

  // cleanup and grab new links
  const refreshLinkIntercepts = () => {
    links.set(grabAllLinks());
  };

  return { links, refreshLinkIntercepts };
}

/**
 * fetchContent
 * @param routeString
 * @returns
 */
async function loadHTML(routeString: string) {
  const target = routeToRelativeUrl(routeString);
  return await loadPageAndCache(target);
}

/**
 * RouterConfig
 * @param routerConfig
 * @returns
 */
export function createRouter(routerConfig: RouterConfig): Router {
  const { onLoadRoute, onUnloadRoute } = routerConfig;
  const route = state("");
  const isRouteLoaded = state(false);
  const { refreshLinkIntercepts } = interceptLinkClick({
    onClick: (href) => {
      navigateTo(href);
    },
  });

  route.onChange(async (newRoute, prevRoute) => {
    isRouteLoaded.set(false);

    const entirePageHTML = (await loadHTML(newRoute)) as string;
    const bodyHtml = /<body.*?>([\s\S]*)<\/body>/.exec(
      entirePageHTML
    )?.[1] as string;

    console.log(bodyHtml);

    // update the document
    swapBody(bodyHtml);
    isRouteLoaded.set(true);

    // onRouteChange?.(newRoute, prevRoute);
  });

  isRouteLoaded.onChange(() => {
    if (isRouteLoaded.value === true) {
      // successfully landed the new page
      refreshLinkIntercepts();
      // scrol to top
      window.scrollTo(0, 0);
      onLoadRoute?.(route.value);
      return;
    }

    onUnloadRoute?.(route.value);
  });

  function swapBody(newBodyString: string) {
    document.body.innerHTML = newBodyString;
  }

  function navigateTo(newRoute: string) {
    // save route to browser state
    window.history.pushState({}, "", newRoute);
    // go back
    route.set(newRoute);
  }

  function handlePageBack() {
    route.set(window.location.href);
  }
  window.addEventListener("popstate", handlePageBack);

  function cleanup() {
    window.removeEventListener("popstate", handlePageBack);
  }

  function useScript(script: () => () => void) {
    // auto detect script load
    const cleanup = script();
    route.onChange(() => {
      cleanup();
      route.unobserveChange(this);
    });
  }

  return {
    navigateTo: navigateTo,
    useScript: useScript,
    observeRouteChange: (callback: RouteChangeHandler) =>
      route.onChange(callback),
    unobserveRouteChange: (callback: RouteChangeHandler) =>
      route.unobserveChange(callback),
    cleanup: cleanup,
  };
}
