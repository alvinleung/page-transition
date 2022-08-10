import { Router } from "./router";

interface TransitionInterface {
  transitionExitComplete: () => void;
}

type CleanupFunction = () => void;
type PageScript = (transitionInterface: TransitionInterface) => CleanupFunction;

const transitionManager = createTransitionManager();

function createTransitionManager() {
  return {};
}

export function createTransition(router: Router, pageScript: PageScript) {
  function transitionExitComplete() {
    // handle Transition Done
  }

  const cleanup = pageScript({ transitionExitComplete });

  router.observeRouteChange(() => {
    // handle route change
    cleanup();
  });
}
