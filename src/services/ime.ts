export interface IMEKeyboardEvent {
  key: string;
  shiftKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
}

export function isIMEComposing(event: Pick<IMEKeyboardEvent, "isComposing" | "keyCode">) {
  return event.isComposing === true || event.keyCode === 229;
}

export function shouldSubmitOnEnter(event: IMEKeyboardEvent, localComposing = false) {
  return event.key === "Enter"
    && event.shiftKey !== true
    && !localComposing
    && !isIMEComposing(event);
}
