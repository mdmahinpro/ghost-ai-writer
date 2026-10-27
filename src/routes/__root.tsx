import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AppCrashBoundary } from "@/lib/error-component";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppShell } from "@/components/shell";
import { TokenGate } from "@/components/token-gate";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Ghost AI Writer" },
      { name: "description", content: "Six-stage content automation for Ghost. Single-shot writes, link graph, static delivery." },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#ffffff" />
        <meta name="apple-mobile-web-app-title" content="Ghost AI Writer" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var raw=localStorage.getItem("gaw-theme");var L=["light","paper","daylight","sepia","rose","clay","editorial"],D=["dark","midnight","forest","ocean","telemetry","crimson","graphite"];var t="paper";if(raw&&D.indexOf(raw)>=0)t="midnight";else if(raw&&L.indexOf(raw)>=0)t="paper";var el=document.documentElement;el.setAttribute("data-theme",t);var c={midnight:"#0a0a0a",paper:"#ffffff"}[t];var m=document.querySelector(\'meta[name="theme-color"]\');if(m)m.setAttribute("content",c);}catch(e){}})();',
          }}
        />
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AppCrashBoundary>
          
            <TokenGate>
              <AppShell>
                <Outlet />
              </AppShell>
            </TokenGate>
          
        </AppCrashBoundary>
        <Scripts />
      </body>
    </html>
  ),
});
