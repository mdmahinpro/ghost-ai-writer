import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { AppCrashBoundary } from "@/lib/error-component";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppShell } from "@/components/shell";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ghost AI Writer" },
      { name: "description", content: "Six-stage content automation for Ghost. Single-shot writes, link graph, static delivery." },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#09090b" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var raw=localStorage.getItem("gaw-theme");var t=raw;if(t==="light")t="paper";if(t==="dark"||!t)t="midnight";var ok={midnight:1,paper:1,forest:1,rose:1,sepia:1,ocean:1};if(!ok[t])t="midnight";if(raw!==t)localStorage.setItem("gaw-theme",t);var el=document.documentElement;el.setAttribute("data-theme",t);el.classList.remove("light");var c={midnight:"#09090b",paper:"#fafafa",forest:"#0c1410",rose:"#fbf4f6",sepia:"#f4efe4",ocean:"#06141c"}[t];var m=document.querySelector(\'meta[name="theme-color"]\');if(m)m.setAttribute("content",c);}catch(e){}})();',
          }}
        />
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AppCrashBoundary>
          <AuthProvider>
            <AppShell>
              <Outlet />
            </AppShell>
          </AuthProvider>
        </AppCrashBoundary>
        <Scripts />
      </body>
    </html>
  ),
});
