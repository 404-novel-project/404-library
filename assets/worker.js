globalThis.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/books/" })
      .then(
        (registration) => {
          console.log("Service worker registration succeeded:", registration);
        },
        (error) => {
          console.log("Service worker registration failed:", error);
        }
      );
  } else {
    console.log("Service workers are not supported.");
  }
});
