import { loadPageAndCache } from "./pageCache";
import { state } from "./util";

type RouteChangeHandler = (newRoute: string, prevRoute: string) => void;

interface RouterConfig {
  onLoadRoute?: (target: string) => void;
  onUnloadRoute?: (target: string) => void;
}

export interface Router {
  getCurrentRoute: () => string;
  navigateTo: (newRoute: string) => void;
  observeRouteChange: (routeChangeHandler: RouteChangeHandler) => void;
  unobserveRouteChange: (routeChangeHandler: RouteChangeHandler) => void;
  observePageLoad: (callback: Function) => void;
  unobservePageLoad: (callback: Function) => void;
  observePageUnload: (callback: Function) => void;
  unobservePageUnload: (callback: Function) => void;
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

function swapBody(newBodyString: string) {
  // attribute name of the "persist-id" to tag persistent element
  const ATTR_PERSIST_ID = "persist-id";

  const appendScript = (
    baseElement: HTMLElement,
    elm: HTMLScriptElement,
    blockExecution = (src: string) => false
  ) => {
    const src = elm.attributes.getNamedItem("src")?.value as string;
    if (src !== undefined && blockExecution(src)) {
      return;
    }

    const newScript = document.createElement("script");
    Array.from(elm.attributes).forEach((attr) => {
      // prevent executing the current one
      newScript.setAttribute(attr.name, attr.value);
    });
    newScript.appendChild(document.createTextNode(elm.innerHTML));
    baseElement.appendChild(newScript);
    return;
  };

  const appendNewContent = function (
    baseElement: HTMLElement,
    html: string,
    blockExecution = (src: string) => false,
    persistentElms: HTMLCollection
  ) {
    const persistentElmIdsLookup = (() => {
      const idLookup = {};
      Array.from(persistentElms).forEach((elm) => {
        const persistId = elm.getAttribute(ATTR_PERSIST_ID) as string;
        idLookup[persistId] = elm;
      });

      return idLookup;
    })();

    const dummyContainer = document.createElement("div");
    dummyContainer.innerHTML = html;

    // add all elements from old html to new
    Array.from(dummyContainer.children).forEach((elm) => {
      if (elm.hasAttribute(ATTR_PERSIST_ID)) {
        // do not replace when the new element already exist on dom
        const elmPersistId = elm.getAttribute(ATTR_PERSIST_ID) as string;
        const existOnCurrentDOM = persistentElmIdsLookup[elmPersistId];
        if (existOnCurrentDOM) return;
      }

      if (elm.tagName === "SCRIPT") {
        appendScript(baseElement, elm as HTMLScriptElement, blockExecution);
        return;
      }

      const clone = elm.cloneNode(true);
      baseElement.appendChild(clone);
    });
  };

  const blockJQueryAndWebflow = (src: string) => {
    if (src.includes("webflow") || src.includes("jquery")) {
      return true;
    }
    return false;
  };

  // use persist-id attribute to tag elements
  // that are needed to persist across pages
  const elmsToRemove = document.body.querySelectorAll(
    `body > *:not([${ATTR_PERSIST_ID}])`
  );
  elmsToRemove.forEach((elm) => elm.remove());
  const persistentElms = document.body.children;
  appendNewContent(
    document.body,
    newBodyString,
    blockJQueryAndWebflow,
    persistentElms
  );
}

type PageScript = () => () => void;
function createPageScriptExecutor() {
  let pageScriptsCleanups: (() => void)[] = [];

  function executeScript(script: PageScript) {
    const cleanup = script();
    pageScriptsCleanups.push(cleanup);
  }
  function cleanupExecutedScript() {
    pageScriptsCleanups.forEach((cleanup) => {
      cleanup && cleanup();
    });

    pageScriptsCleanups = [];
  }

  return { executeScript, cleanupExecutedScript };
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
      const target = href ? href : "/";
      navigateTo(target);
    },
  });

  const { executeScript, cleanupExecutedScript } = createPageScriptExecutor();

  // initial execution
  // window.addEventListener("load", execuatePageScripts);

  route.onChange(async (newRoute, prevRoute) => {
    // call exit page
    cleanupExecutedScript();

    console.log(`Changing to ${newRoute}`);
    isRouteLoaded.set(false);

    const entirePageHTML = (await loadHTML(newRoute)) as string;
    const bodyHtml = /<body.*?>([\s\S]*)<\/body>/.exec(
      entirePageHTML
    )?.[1] as string;

    // update the document
    swapBody(bodyHtml);
    isRouteLoaded.set(true);
    // onRouteChange?.(newRoute, prevRoute);
  });

  function useScript(script: () => () => void) {
    // execute script when loaded
    executeScript(script);
  }

  const [observePageLoad, unobservePageLoad, firePageLoad] = createObserver();
  const [observePageUnload, unobservePageUnload, firePageUnload] =
    createObserver();

  isRouteLoaded.onChange(() => {
    if (isRouteLoaded.value === true) {
      // successfully landed the new page
      refreshLinkIntercepts();
      // scrol to top
      window.scrollTo(0, 0);
      onLoadRoute?.(route.value);
      firePageLoad();
      return;
    }

    onUnloadRoute?.(route.value);
    firePageUnload();
  });

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

  return {
    navigateTo: navigateTo,
    useScript: useScript,
    observeRouteChange: (callback: RouteChangeHandler) =>
      route.onChange(callback),
    unobserveRouteChange: (callback: RouteChangeHandler) =>
      route.unobserveChange(callback),
    observePageLoad: observePageLoad,
    unobservePageLoad: unobservePageLoad,
    observePageUnload: observePageUnload,
    unobservePageUnload: unobservePageUnload,
    cleanup: cleanup,
    getCurrentRoute: () => route.value,
  };
}

function createObserver(): [
  (callback: Function) => void,
  (callback: Function) => void,
  () => void
] {
  const callbacks: Function[] = [];
  const observe = (callback: Function) => {
    callbacks.push(callback);
  };
  const unobserve = (callback: Function) => {
    const removeIndex = callbacks.indexOf(callback);
    removeIndex !== -1 && callbacks.splice(removeIndex);
  };
  function fire() {
    callbacks.forEach((callback) => callback());
  }
  return [observe, unobserve, fire];
}
