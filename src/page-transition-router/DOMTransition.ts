import { loadPageAndCache } from "./network";

/**
 * fetchContent
 * @param routeString
 * @returns
 */

export function swapBody(newBodyString: string) {
  // attribute name of the "persist-id" to tag persistent element
  const ATTR_PERSIST_ID = "persist-id";
  const ATTR_PERSIST_PERMANENT = "persist-permanent";

  const appendScript = (
    baseElement: HTMLElement,
    elm: HTMLScriptElement,
    blockExecution = (src: string) => false
  ) => {
    const src = elm.attributes.getNamedItem("src")?.value as string;
    if (src !== undefined && blockExecution(src)) {
      return;
    }

    const newScript = document.createElement("script");
    Array.from(elm.attributes).forEach((attr) => {
      // prevent executing the current one
      newScript.setAttribute(attr.name, attr.value);
    });
    newScript.appendChild(document.createTextNode(elm.innerHTML));
    baseElement.appendChild(newScript);
    return;
  };

  const createReadOnceLookup = <T>() => {

    type Lookup = {
      [key: string]: T
    }

    const lookup: Lookup = {}

    return {
      add: (key: string, value: T) => {
        lookup[key] = value;
      },
      readAndDelete: (key: string) => {
        const value = lookup[key];
        delete lookup[key];
        return value;
      },
      getUnread: () => lookup
    }
  }

  const appendNewContent = function (
    baseElement: HTMLElement,
    html: string,
    blockExecution = (src: string) => false,
    persistentElms: HTMLCollection
  ) {

    const persistentElmIdsLookup = (() => {
      const idLookup = createReadOnceLookup();
      Array.from(persistentElms).forEach((elm) => {
        const persistId = elm.getAttribute(ATTR_PERSIST_ID) as string;
        idLookup.add(persistId, elm);
      });

      return idLookup
    })();

    const dummyContainer = document.createElement("div");
    dummyContainer.innerHTML = html;


    // add all elements from old html to new
    Array.from(dummyContainer.children).forEach((elm) => {
      if (elm.hasAttribute(ATTR_PERSIST_ID)) {
        // do not replace when the new element already exist on dom
        const elmPersistId = elm.getAttribute(ATTR_PERSIST_ID) as string;
        const existOnCurrentDOM = persistentElmIdsLookup.readAndDelete(elmPersistId);
        if (existOnCurrentDOM) return;
      }

      if (elm.tagName === "SCRIPT") {
        appendScript(baseElement, elm as HTMLScriptElement, blockExecution);
        return;
      }

      const clone = elm.cloneNode(true);
      baseElement.appendChild(clone);
    });


    // remove persist elements that are not on the new page
    const persistElmsToRemove = persistentElmIdsLookup.getUnread();
    Object.values(persistElmsToRemove).forEach((elm) => {
      const persistElm = elm as HTMLElement;
      // let the element stay if it declared permanace
      if (persistElm.getAttribute(ATTR_PERSIST_PERMANENT) !== "true")
        document.removeChild(persistElm);
    })

  };


  const blockJQueryAndWebflow = (src: string) => {
    if (src.includes("webflow") || src.includes("jquery")) {
      return true;
    }
    return false;
  };

  // use persist-id attribute to tag elements
  // that are needed to persist across pages
  const elmsToRemove = document.body.querySelectorAll(
    `body > *:not([${ATTR_PERSIST_ID}])`
  );
  elmsToRemove.forEach((elm) => {
    elm.remove();
  });
  const persistentElms = document.body.children;
  appendNewContent(
    document.body,
    newBodyString,
    blockJQueryAndWebflow,
    persistentElms
  );
}
