import { State } from "./util";

interface ExitTransition {
  nextPath: string;
  beginExitTransition: () => void;
  endExitTransition: () => void;
  onExitTransitionDone: (handler: (aborted: boolean) => void) => void;
}
export type PageScript = (
  fromRoute?: string
) => (exitTransition: ExitTransition) => void;
export function createPageScriptExecutor(route: State<string>) {
  let pageScriptsCleanups: ((transition: ExitTransition) => void)[] = [];

  // CLEANUP STATES
  let _isPerformingCleanup = false;
  function isPerformingCleanup() {
    return _isPerformingCleanup;
  }

  /**
   * Declare and execute a page script
   * @param script
   */
  function executeScript(script: PageScript) {
    const cleanup = script();
    if (cleanup) pageScriptsCleanups.push(cleanup);
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
            let _doneCallback: Function = () => {};
            // call the cleanup
            cleanup({
              nextPath: route.value,
              beginExitTransition: () => (useTransitionDelay = true),
              endExitTransition: () => {
                // trigger done state
                _doneCallback(false);
                resolve(true);
              },
              onExitTransitionDone: (
                doneCallback: (aborted: boolean) => void
              ) => {
                _doneCallback = doneCallback;

                // setting up abort callback
                const abort = () => {
                  hasAbortedCleanup = true;
                  // resolve the promise when aborting
                  resolve(false);
                  doneCallback(true);

                  // remove the abort
                  const abortIndex = abortTransitionCallbacks.indexOf(abort);
                  abortTransitionCallbacks.splice(abortIndex, 1);
                };
                abortTransitionCallbacks.push(abort);
              },
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
    isPerformingCleanup,
  };
}
