export interface State<T> {
  value: T;
  prevValue: T;
  set: (newState: T) => void;
  onChange: (callback: StateChangeCallback<T>) => void;
  unobserveChange: (callback: StateChangeCallback<T>) => void;
}

type StateChangeCallback<T> = (newValue: T, prevState: T) => void;
export function state<T>(initial: T): State<T> {
  let allCallbacks: Array<StateChangeCallback<T>> = [];
  let state = {
    value: initial,
    prevValue: initial,
    set: (newValue: T) => {
      const prevState = state.value;

      // abort state change when they are the same
      if (prevState === newValue) return;

      state.value = newValue;
      state.prevValue = prevState;

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

export function createObserver(): [
  (callback: Function) => void,
  (callback: Function) => void,
  () => void
] {
  const callbacks: Function[] = [];
  const observe = (callback: Function) => {
    callbacks.push(callback);
  };
  const unobserve = (callback: Function) => {
    const removeIndex = callbacks.indexOf(callback);
    removeIndex !== -1 && callbacks.splice(removeIndex);
  };
  function fire() {
    callbacks.forEach((callback) => callback());
  }
  return [observe, unobserve, fire];
}
