"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { initMetaPixel, sanitizeMetaPixelId, trackMetaPixelPageViewOnce } from "@/lib/metaPixel";

type MetaPixelProps = {
  pixelId?: string | null;
};

export default function MetaPixel({ pixelId }: MetaPixelProps) {
  const pathname = usePathname();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const pageViewSentRef = useRef(false);

  const safePixelId = useMemo(() => sanitizeMetaPixelId(pixelId), [pixelId]);
  const shouldActivate = Boolean(safePixelId);

  useEffect(() => {
    if (!shouldActivate) {
      pageViewSentRef.current = false;
      return;
    }

    if (!shouldActivate || !safePixelId) {
      return;
    }

    if (!scriptLoaded && typeof window.fbq !== "function") {
      return;
    }

    initMetaPixel(safePixelId);

    if (pageViewSentRef.current) {
      return;
    }

    const eventKey = `${safePixelId}:${pathname || "/"}`;
    const disparou = trackMetaPixelPageViewOnce(safePixelId, eventKey);
    if (disparou) {
      pageViewSentRef.current = true;
    }
  }, [pathname, safePixelId, scriptLoaded, shouldActivate]);

  if (!shouldActivate) {
    return null;
  }

  return (
    <>
      <Script
        id="meta-pixel-bootstrap"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(f){
              if (f.fbq) return;
              var n = function(){
                n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
              };
              if (!f._fbq) {
                f._fbq = n;
              }
              n.push = n;
              n.loaded = true;
              n.version = '2.0';
              n.queue = [];
              f.fbq = n;
            })(window);
          `,
        }}
        onReady={() => {
          setScriptLoaded(true);
        }}
      />

      <Script
        id="meta-pixel-script"
        src="https://connect.facebook.net/en_US/fbevents.js"
        strategy="afterInteractive"
        onLoad={() => {
          setScriptLoaded(true);
        }}
        onError={() => {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[META PIXEL] Bloqueado ou indisponível");
          }
        }}
      />
    </>
  );
}
