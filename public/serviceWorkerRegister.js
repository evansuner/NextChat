if ("serviceWorker" in navigator) {
  window.addEventListener("DOMContentLoaded", function () {
    navigator.serviceWorker.register("/serviceWorker.js").then(
      function (registration) {
        console.log(
          "ServiceWorker registration successful with scope: ",
          registration.scope,
        );
        registration.update().then((res) => {
          console.log("ServiceWorker registration update: ", res);
        });
        window._SW_ENABLED = true;
      },
      function (err) {
        console.error("ServiceWorker registration failed: ", err);
      },
    );
  });
}
