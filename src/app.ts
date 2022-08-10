import { createRouter, Router } from "./page-transition-router/router";

// exposing the router object
//@ts-ignore
const router = createRouter({
  onLoadRoute: () => {
    // console.log("document loaded");
  },
});

//@ts-ignore
// const router: Router = window.router as Router;
