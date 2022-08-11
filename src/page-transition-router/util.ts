// type SetStateFunction = <T>(newValue: Partial<T>) => void;

// export function state<T extends Object>(
//   initial: T,
//   onUpdate: (newValue: T) => {}
// ): SetStateFunction {
//   const currentState = { ...initial };
//   return <T>(newValue: Partial<T>) => {
//     // partial
//     Object.keys(newValue).forEach((stateKey) => {
//       currentState[stateKey] = newValue[stateKey];
//     });
//     onUpdate(currentState);
//   };
// }

/**
 * useEffect
 */
type EffectCleanup = () => void;
type EffectHandler = () => void | EffectCleanup;

let allOldDependency: Array<Array<any>> = [];
let allCleanupFunc: Array<Function | void> = [];
let currRenderHookId = 0;

function resetHookId() {
  currRenderHookId = 0;
}

export const firstRender = (fn: EffectHandler) => observeState([], fn);
export function observeState(dependency: Array<any>, fn: EffectHandler) {
  let hasChange = true;

  // "create if empty"
  const cleanupFunc = allCleanupFunc[currRenderHookId] || new Function();
  const oldDependency = allOldDependency[currRenderHookId] || [];
  cleanupFunc[currRenderHookId] = cleanupFunc;
  allOldDependency[currRenderHookId] = oldDependency;

  currRenderHookId++;

  // cleanuop function
  if (cleanupFunc) cleanupFunc();

  function involkeHandler() {
    cleanupFunc[currRenderHookId] = fn();
  }

  if (oldDependency.length == 0) {
    involkeHandler();
    return;
  }

  for (let i = 0; i < oldDependency.length; i++) {
    if (oldDependency[i] == dependency[i]) {
      oldDependency[i] = dependency[i];
      hasChange = true;
    }
  }

  if (hasChange) {
    involkeHandler();
    hasChange = false;
  }
}

/**
 * component
 */
export type RenderStateFunction<T> = (
  state: T,
  setState: (newState: Partial<T>) => void
) => void;
export type SetStateFunction<T> = (newState: Partial<T>) => void;

export function createState<T extends Object>(
  initialState: T,
  onStateUpdate: RenderStateFunction<T>
): [T, SetStateFunction<T>] {
  let currState = { ...initialState };
  let prevState = { ...currState };

  function fireStateChange() {
    // detect state change
    onStateUpdate(currState, updateState);
    resetHookId();
  }

  const setSingleState = (key: string, value: unknown) => {
    if (currState[key] !== value) {
      currState[key] = value;
    }
  };

  const updateState = (newState: Partial<T>) => {
    Object.keys(newState).forEach((stateKey) =>
      setSingleState(stateKey, newState[stateKey])
    );

    fireStateChange();
  };

  fireStateChange();

  return [currState, updateState];
}

interface State<T> {
  value: T;
  set: (newState: T) => void;
  onChange: (callback: StateChangeCallback<T>) => void;
  unobserveChange: (callback: StateChangeCallback<T>) => void;
}

type StateChangeCallback<T> = (newValue: T, prevState: T) => void;
export function state<T>(initial: T): State<T> {
  let allCallbacks: Array<StateChangeCallback<T>> = [];
  let state = {
    value: initial,
    set: (newState: T) => {
      const prevState = state.value;
      state.value = newState;

      allCallbacks.forEach((callback) => callback(state.value, prevState));
    },
    onChange: (callback: StateChangeCallback<T>) => {
      allCallbacks.push(callback);
    },
    unobserveChange: (callback: StateChangeCallback<T>) => {
      const removeIndex = allCallbacks.indexOf(callback);
      allCallbacks.splice(removeIndex, 1);
      console.log(allCallbacks);
    },
  };

  return state;
}

type StateGroup = Array<State<any>>;
export function observeStateChange<T extends any>(
  states: State<T>[],
  callback: (newValue: StateGroup) => void
) {
  function handleStateChange() {
    callback(states);
  }

  states.forEach((state) => {
    state.onChange(handleStateChange);
  });
}
