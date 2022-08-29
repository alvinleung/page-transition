import { interceptLinkClick } from "./interceptLinkClick";
import { loadHTML, loadPageAndCache } from "./network";
import { createPageScriptExecutor, PageScript } from "./pageScriptExecutor";
import { swapBody } from "./DOMTransition";
import { createObserver, State, state } from "./util";

type RouteChangeHandler = (newRoute: string, prevRoute: string) => void;

const VERBOSE = false;

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
  useScript: (script: PageScript) => void;
  refershHrefTargets: () => void;
  cleanup: () => void;
}

/**
 * RouterConfig
 * @param routerConfig
 * @returns
 */
export function createRouter(routerConfig: RouterConfig): Router {
  const { onLoadRoute, onUnloadRoute } = routerConfig;

  const initialRoute = window.location.href;
  const route = state(initialRoute); // actual route
  const routePresented = state(initialRoute); // how it is present on the screen

  const isRouteLoaded = state(false);
  const { refreshLinkIntercepts } = interceptLinkClick({
    onClick: (href) => {
      const target = href ? href : "/";
      navigateTo(target);
    },
  });

  /*
  
  ----------------------------------------

  Handle Route Change

  ----------------------------------------
  
  */

  const { executeScript, cleanupExecutedScript, abortCleanup } =
    createPageScriptExecutor(route);

  route.onChange(async (newRoute) => {
    VERBOSE && console.log("Aborting attempted cleanups");
    abortCleanup();

    // if the user is going back to the original page,
    // skip the rest of cleanup process
    if (newRoute == routePresented.value) {
      VERBOSE && console.log(`Go back to ${route.value}`);
      return;
    }

    // set loaded state to false
    isRouteLoaded.set(false);

    const cleanupSuccess = await cleanupExecutedScript();
    if (!cleanupSuccess) {
      VERBOSE && console.log(`Aborted ${newRoute}`);
      return;
    }

    VERBOSE && console.log(`Change route to ${newRoute}`);

    const entirePageHTML = (await loadHTML(newRoute)) as string;
    const bodyHtml = /<body.*?>([\s\S]*)<\/body>/.exec(
      entirePageHTML
    )?.[1] as string;
    const documentTitle = /<title.*?>([\s\S]*)<\/title>/.exec(
      entirePageHTML
    )?.[1] as string;

    // update the document
    swapBody(bodyHtml, documentTitle);

    // update related state
    routePresented.set(newRoute);
    isRouteLoaded.set(true);

    VERBOSE && console.log(`Loaded new route`);
    // onRouteChange?.(newRoute, prevRoute);
  });

  /*
  
  ----------------------------------------

  Page Load and Unload Events

  ----------------------------------------
  
  */

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

  /*
  
  ----------------------------------------

  Page navigation Function

  ----------------------------------------
  
  */

  function navigateTo(newRoute: string) {
    // save route to browser state
    if (newRoute !== route.value) window.history.pushState({}, "", newRoute);
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
    useScript: executeScript,
    observeRouteChange: (callback: RouteChangeHandler) =>
      route.onChange(callback),
    unobserveRouteChange: (callback: RouteChangeHandler) =>
      route.unobserveChange(callback),
    observePageLoad: observePageLoad,
    unobservePageLoad: unobservePageLoad,
    observePageUnload: observePageUnload,
    unobservePageUnload: unobservePageUnload,
    refershHrefTargets: refreshLinkIntercepts,
    cleanup: cleanup,
    getCurrentRoute: () => route.value,
  };
}
