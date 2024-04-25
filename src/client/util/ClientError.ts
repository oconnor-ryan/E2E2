export function formatError(code: string, message?: string) {
  let e = new Error(message ?? code);
  e.name = code;
  return e;
}

export function displayError(e: Error) {
  window.alert(e.name + ": " + e.message);
}