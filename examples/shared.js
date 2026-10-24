// Collects runtime errors so the example pages (and the test harness) can
// report failures instead of failing silently.
window.__demoErrors = [];
window.__ready = false;
window.addEventListener("error", (event) => {
  window.__demoErrors.push(
    String(event.message) + " @" + String(event.filename) + ":" + String(event.lineno)
  );
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason && event.reason.message ? event.reason.message : event.reason;
  window.__demoErrors.push("rejection: " + String(reason));
});
