import { createRouter, Router } from "./page-transition-router/router";

// exposing the router object
const router = createRouter({
  onLoadRoute: () => {},
});

//@ts-ignore
window.router = router;
