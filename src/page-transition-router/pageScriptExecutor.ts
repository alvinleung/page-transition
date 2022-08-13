import { State } from "./util";

type FinishTransition = () => void;

interface ExitState {
  nextPath: string;
  beginTransition: () => {
    finish: FinishTransition;
    onAbort: (handler: () => void) => void;
  };
  // onAbortTransition: (handler: () => void) => void;
}
export type PageScript = (
  fromRoute?: string
) => (exitTransition: ExitState) => void;
export function createPageScriptExecutor(route: State<string>) {
  let pageScriptsCleanups: ((transition: ExitState) => void)[] = [];

  /**
   * Declare and execute a page script
   * @param script
   */
  function executeScript(script: PageScript) {
    const invoke = () => {
      const cleanup = script(route.prevValue);
      if (cleanup) pageScriptsCleanups.push(cleanup);
    };
    // don't invoke right away, only invoke when the document is loaded
    if (document.readyState !== "complete") {
      window.addEventListener("load", () => {
        invoke();
      });
      return;
    }
    invoke();
  }

  let abortTransitionCallbacks: Function[] = [];

  // trigger for all the abort functions
  const abortCleanup = () => {
    abortTransitionCallbacks.forEach((abort) => abort());
  };

  // return success
  async function cleanupExecutedScript() {
    // _isPerformingCleanup = true;
    // pageScriptsCleanups.forEach((cleanup) => {
    //   cleanup && cleanup();
    // });

    let hasAbortedCleanup = false;

    // init the abort callbacks
    await Promise.all(
      pageScriptsCleanups.map(
        (cleanup) =>
          new Promise<boolean>((resolve, reject) => {
            let useTransitionDelay = false;

            const beginTransition = () => {
              useTransitionDelay = true;
              const finish = () => {
                // trigger done state
                resolve(true);
              };
              const onAbort = (handleAbort: () => void) => {
                // setting up abort callback
                const abort = () => {
                  hasAbortedCleanup = true;
                  // resolve the promise when aborting
                  resolve(false);
                  handleAbort();

                  // remove the abort
                  const abortIndex = abortTransitionCallbacks.indexOf(abort);
                  abortTransitionCallbacks.splice(abortIndex, 1);
                };
                abortTransitionCallbacks.push(abort);
              };
              return {
                finish: finish,
                onAbort: onAbort,
              };
            };
            // call the cleanup
            cleanup({
              nextPath: route.value,
              beginTransition: beginTransition,
            });

            // resolve right away if the consumer of the api
            // didn't begin a transition
            if (!useTransitionDelay) resolve(true);
          })
      )
    );

    if (hasAbortedCleanup) {
      return false;
    }

    // abortTransitionCallbacks = [];
    pageScriptsCleanups = [];
    // _isPerformingCleanup = false;
    return true;
  }

  return {
    executeScript,
    cleanupExecutedScript,
    abortCleanup,
  };
}
