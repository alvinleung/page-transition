import { createRouter } from "./page-transition-router/router";

//@ts-ignore
window.router = createRouter({
  onRouteChange: (newRoute) => {
    // console.log("Changing to route " + newRoute);
  },
  onLoadRoute: () => {
    // console.log("document loaded");
  },
});
