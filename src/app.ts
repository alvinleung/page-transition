import { createRouter, Router } from "./page-transition-router/router";

// exposing the router object
const router = createRouter({});

//@ts-ignore
window.daybreak = window.daybreak || {};

//@ts-ignore
window.daybreak.router = router;
