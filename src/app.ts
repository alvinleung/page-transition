import { createRouter, Router } from "./page-transition-router/router";

// exposing the router object
//@ts-ignore
window.router = createRouter({
  onLoadRoute: () => {},
});
