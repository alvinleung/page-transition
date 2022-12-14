import { loadPageAndCache } from "./network";
import { state } from "./util";

const isExternalLink = (url) => {
  const tmp = document.createElement("a");
  tmp.href = url;
  return tmp.host !== window.location.host;
};

/**
 * Intercept Link click
 * @param param0
 * @returns
 */
export function interceptLinkClick({ onClick = (link: string) => {} }) {
  const grabAllLinks = () => document.querySelectorAll("a");

  const links = state(
    document.readyState === "interactive" ? grabAllLinks() : undefined
  );

  const handleIntersection = (entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      const targetLink = entry.target as HTMLAnchorElement;
      if (entry.isIntersecting) {
        if (!targetLink.hasAttribute("prefetched")) {
          loadPageAndCache(targetLink.href);
          targetLink.setAttribute("prefetched", "true");
        }
      }
    });
  };
  let linkObserver: IntersectionObserver = new IntersectionObserver(
    handleIntersection
  );
  links.onChange((links, prevLinks) => {
    if (!links) return;

    // clear all observer links if there is a observer here
    if (linkObserver) linkObserver.disconnect();

    // add remove all previous intercepts
    if (prevLinks) {
      prevLinks.forEach((link) =>
        link.removeEventListener("click", handleLinkClick)
      );
    }

    // add intercept
    links.forEach((link) => link.addEventListener("click", handleLinkClick));

    // prefetch all links that is on screen
    links.forEach((link) => {
      linkObserver.observe(link);
    });
  });

  // if not, then load it after the document is loaded
  window.addEventListener("DOMContentLoaded", () => {
    links.set(grabAllLinks());
  });

  function handleLinkClick(e: MouseEvent) {
    const href = (e.target as HTMLAnchorElement).href;
    if (isExternalLink(href)) return;

    e.preventDefault();
    onClick(href);
  }

  // cleanup and grab new links
  const refreshLinkIntercepts = () => {
    links.set(grabAllLinks());
  };

  return { links, refreshLinkIntercepts };
}
