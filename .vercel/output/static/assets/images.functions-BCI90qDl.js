import{n as e,t}from"./createServerFn-DKHW2zIo.js";import{r as n}from"./utils-BH-8VFRH.js";var r=[{key:`intent`,label:`Intent & Blueprint`,tokens:[730,790],ms:1600},{key:`draft`,label:`Draft`,tokens:[2100,2400],ms:2200},{key:`revision`,label:`Quality & Coverage Revision`,tokens:[2300,2800],ms:1800},{key:`metadata`,label:`Metadata & Packaging`,tokens:[450,490],ms:700},{key:`enrichment`,label:`Site Enrichment`,tokens:[1400,1520],ms:1e3},{key:`publish`,label:`Final Validation & Publication`,tokens:[0,0],ms:650}],i=[`site_top`,`home_feed`,`article_top`,`article_inline`,`article_bottom`,`article_sidebar`,`site_bottom`],a=16384,o={site_top:`Below header`,home_feed:`Between homepage posts`,article_top:`Before article content`,article_inline:`Inside article`,article_bottom:`After article content`,article_sidebar:`Article side column`,site_bottom:`Above footer`},s={site_top:{desktop:`Full width below header`,mobile:`Full width below header`},home_feed:{desktop:`After the sixth card when there are at least seven posts`,mobile:`After the sixth card when there are at least seven posts`},article_top:{desktop:`Above the first paragraph`,mobile:`Above the first paragraph`},article_inline:{desktop:`After paragraph three when there are at least six top-level paragraphs`,mobile:`After paragraph two when there are at least six top-level paragraphs`},article_bottom:{desktop:`After the last paragraph`,mobile:`After the last paragraph`},article_sidebar:{desktop:`300px right rail, viewport ≥1200px`,mobile:`Hidden (no rail under 1200px)`},site_bottom:{desktop:`Above footer`,mobile:`Above footer`}};function c(){return i.map(e=>({id:e,enabled:!1,name:o[e],adType:`custom_code`,code:``,position:s[e]}))}var l={keywordCap:null,concurrency:24,ideaCap:null,restartLimit:null,buildHistory:500},u=[{key:`niche`,name:`Niche understanding`,engine:`llm`},{key:`audience`,name:`Audience map`,engine:`llm`},{key:`problem`,name:`Problem map`,engine:`llm`},{key:`topic-universe`,name:`Topic universe`,engine:`llm`},{key:`query-expansion`,name:`Query expansion`,engine:`llm`},{key:`intent-class`,name:`Intent classification`,engine:`llm`},{key:`semantic-consolidation`,name:`Semantic consolidation`,engine:`derived`},{key:`coverage`,name:`Existing coverage mapping`,engine:`llm`},{key:`cluster-construction`,name:`Cluster construction`,engine:`llm`},{key:`action-class`,name:`Content action classification`,engine:`derived`},{key:`priority`,name:`Strategic priority inputs`,engine:`llm`}],d=.85,f=.88;function p(e){return e===`light`?[1,2]:e===`dense`?[4,6]:[2,4]}var m=`https://tse1.mm.bing.net`,h=new Set([`a`,`an`,`the`,`how`,`to`,`of`,`for`,`and`,`in`,`on`,`your`,`with`,`from`,`that`,`this`,`is`,`are`,`be`,`it`,`at`,`by`,`or`,`as`,`you`]);function g(e,t=8){let n=e.toLowerCase().replace(/[^a-z0-9\s-]+/g,` `).split(/[\s-]+/).filter(e=>e.length>1&&!h.has(e));return(n.length?n:e.toLowerCase().replace(/[^a-z0-9]+/g,` `).split(/\s+/).filter(Boolean)).slice(0,t).join(`-`).slice(0,80)||`editorial-cover`}function _(e,t=474,n=274){return`${m}/th?q=${encodeURIComponent(g(e))}&w=${t}&h=${n}&c=7`}function v(e){return e?/^https?:\/\/cms\.[^/]+\//i.test(e)||/\/content\/images\//i.test(e):!1}var y=/https?:\/\/cms\.[^\s"'()<>\\]+\/content\/images\/[^\s"'()<>\\]+|\/content\/images\/[^\s"'()<>\\]+/gi;function b(e,t){let n=typeof e==`string`?e:``;return!n||!/content\/images/i.test(n)?n:n.replace(y,()=>_(t))}function x(e){let t=0;for(let n of e??[]){let e=n.keyword||n.title||n.slug||`editorial-cover`;for(let r of n.images??[])r.remote&&v(r.remote)&&(r.remote=_(e),t++),r.src&&v(r.src)&&(r.src=_(e),t++);let r=b(n.html,e);r!==(n.html??``)&&(n.html=r,t++);let i=b(n.markdown,e);i!==(n.markdown??``)&&(n.markdown=i,t++)}return t}function S(e,t){let n=e.remote;return n&&!v(n)?n:_(e.query?.trim()||t,e.width||474,e.height||274)}function C(e,t=``){if(!e.selected&&!e.remote&&!e.src)return``;let r=S(e,e.query?.trim()||e.alt||t),i=e.role===`featured`?`eager`:`lazy`,a=e.width?` width="${e.width}"`:``,o=e.height?` height="${e.height}"`:``;return`<figure class="kg-card kg-image-card"><img src="${n(r)}" alt="${n(e.alt)}"${a}${o} loading="${i}" decoding="async" referrerpolicy="no-referrer" /></figure>`}var w=3;function T(e,t,n,r=``){let i=e.replace(/<!--gaw-image:\d+-->/g,``).replace(/<figure class="kg-card kg-image-card">[\s\S]*?<\/figure>\n?/g,``),a=t.replace(/!\[[^\]]*\]\(slot:\d+\)\n?/g,``).replace(/!\[[^\]]*\]\(\/media\/[^)]+\)\n?/g,``),o=n.filter(e=>(e.selected||e.remote)&&(e.src||e.remote)),s=e=>S(e,e.query?.trim()||e.alt||r),c=new Set,l=o.find(e=>e.role===`featured`)??o[0];l&&c.add(s(l));let u=[];for(let e of o){if(e===l)continue;let t=s(e);if(!c.has(t)&&(c.add(t),u.push(e),u.length>=w))break}l&&(i=`${C(l,r)}\n${i.trim()}`,a=`![${l.alt}](${s(l)})\n\n${a.trim()}`);let d=0;return i=i.replace(/<h2>/g,e=>{let t=u[d];return d+=1,t?`${C(t,r)}\n${e}`:e}),u.forEach(e=>{a+=`\n\n![${e.alt}](${s(e)})\n`}),{html:i,markdown:a}}function E(e){return[...e.matchAll(/\/media\/([a-f0-9]{16,64}\.(?:jpg|png|webp))/gi)].map(e=>e[1].toLowerCase())}function D(e,t){return e.replace(/src="(\/media\/[^"]+)"/g,(e,n)=>`src="${t(n)}"`)}var O=`/__grok/avatar`,k=`https://thispersondoesnotexist.com/image`;function A(e){return`${k}?seed=${encodeURIComponent(e)}`}function j(e){return!!(e&&/^https:\/\/(?:wsrv\.nl\/|images\.weserv\.nl\/|thispersondoesnotexist\.com\/)/i.test(e))}function M(e){if(!e)return null;let t=e=>e&&/^[a-z0-9]{1,40}$/i.test(e)?e:null;try{let n=new URL(e),r=t(n.searchParams.get(`seed`));if(r)return r;let i=n.searchParams.get(`url`);if(i){let e;try{e=new URL(i)}catch{e=new URL(`https://${i}`)}return t(e.searchParams.get(`r`))??t(e.searchParams.get(`seed`))}return null}catch{return null}}function N(e,t=256){let n=M(e.avatarUrl)??e.id;return`${O}?seed=${encodeURIComponent(n)}&size=${t}`}function P(e){let t=2166136261;for(let n=0;n<e.length;n++)t^=e.charCodeAt(n),t=Math.imul(t,16777619);return Math.abs(t)}function F(e,t=``,n=256){let r=P(`${e}:${t}`),i=r%360,a=(i+28+(r>>5)%40)%360,o=t.split(/\s+/).filter(Boolean).map(e=>e[0].toUpperCase()).join(``).slice(0,2)||`GA`,s=Math.round(n*.38),c=Math.round(n*.17),l=Math.round(n*.34);return[`<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 ${n} ${n}" role="img" aria-label="Portrait placeholder">`,`<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">`,`<stop offset="0" stop-color="hsl(${i} 42% 34%)"/><stop offset="1" stop-color="hsl(${a} 46% 18%)"/>`,`</linearGradient><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">`,`<stop offset="0" stop-color="hsl(${i} 24% 88%)" stop-opacity="0.92"/><stop offset="1" stop-color="hsl(${a} 18% 62%)" stop-opacity="0.92"/>`,`</linearGradient></defs>`,`<rect width="${n}" height="${n}" fill="url(#bg)"/>`,`<g fill="url(#fg)">`,`<circle cx="${n/2}" cy="${s}" r="${c}"/>`,`<path d="M${Math.round(n/2-l)} ${n} q${l} -${Math.round(n*.34)} ${l*2} 0 z"/>`,`</g>`,`<text x="50%" y="${Math.round(n*.56)}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${Math.round(n*.16)}" font-weight="600" fill="hsl(${i} 30% 16%)" opacity="0.75">${o}</text>`,`</svg>`].join(``)}function I(e,t=``,n=256){return`data:image/svg+xml;charset=utf-8,${encodeURIComponent(F(e,t,n))}`}function L(){return`
    :root { color-scheme: light; --bg: #f7f3ea; --card: #fffdf8; --ink: #1b1813; --muted: #5b5449; --faint: #8a8171; --line: #e4dac6; --accent: #8a5a12; }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: radial-gradient(1200px 620px at 50% -12%, #fffaf1, transparent 68%), var(--bg); color: var(--ink); font: 18px/1.7 Georgia, "Iowan Old Style", serif; -webkit-font-smoothing: antialiased; }
    header, main, footer { width: min(1040px, calc(100% - 32px)); margin-inline: auto; }
    header { padding: 30px 0 14px; display: flex; justify-content: space-between; gap: 16px; align-items: baseline; border-bottom: 1px solid var(--line); }
    a { color: var(--accent); }
    a:hover { text-decoration-thickness: 2px; }
    .mark { font-family: "Outfit", "Avenir Next", sans-serif; letter-spacing: 0.16em; text-transform: uppercase; font-size: 12px; text-decoration: none; }
    h1 { font-weight: 500; font-size: clamp(30px, 4.6vw, 44px); line-height: 1.13; margin: 16px 0 10px; letter-spacing: -0.01em; }
    h2 { font-weight: 500; font-size: 26px; line-height: 1.2; margin: 34px 0 8px; }
    img { display: block; width: 100%; height: auto; border-radius: 12px; }
    figure { margin: 22px 0 10px; }
    .grid { display: grid; gap: 22px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .card { display: flex; flex-direction: column; gap: 8px; text-decoration: none; color: inherit; padding: 12px; border: 1px solid var(--line); border-radius: 16px; background: var(--card); transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
    .card:hover { transform: translateY(-3px); border-color: #d8cbae; box-shadow: 0 20px 40px -28px rgba(34, 24, 6, 0.6); }
    .card img { aspect-ratio: 16/9; object-fit: cover; margin-bottom: 2px; }
    .card strong { font-weight: 600; line-height: 1.3; }
    .meta { font-family: "Outfit", "Avenir Next", sans-serif; font-size: 13px; letter-spacing: 0.04em; color: var(--muted); }
    main > h1 + p { color: var(--muted); max-width: 60ch; }
    footer { margin-top: 40px; padding: 28px 0 48px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; }
    article.post { width: min(720px, 100%); }
    /* Article body: the full markdown-subset the generator can emit. */
    article.post p { margin: 0 0 18px; }
    article.post h2, article.post h3, article.post h4 { font-family: "Outfit", "Avenir Next", sans-serif; line-height: 1.25; margin: 34px 0 10px; scroll-margin-top: 20px; }
    article.post h2 { font-size: 26px; }
    article.post h3 { font-size: 21px; margin-top: 26px; }
    article.post h4 { font-size: 18px; margin-top: 22px; }
    article.post a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
    article.post ul, article.post ol { margin: 0 0 18px; padding-left: 22px; }
    article.post li { margin: 5px 0; }
    article.post li.task-item { list-style: none; margin-left: -18px; }
    article.post strong { font-weight: 700; }
    article.post del { color: var(--faint); }
    article.post hr { border: 0; border-top: 1px solid var(--line); margin: 30px 0; }
    /* CLS safety: image cards reserve their space before load (code blocks do not). */
    article.post figure.kg-card { aspect-ratio: 16 / 10; background: #eee4cf; overflow: hidden; margin: 22px 0 10px; border-radius: 16px; box-shadow: 0 16px 36px -26px rgba(34, 24, 6, 0.55); }
    article.post figure.kg-card img { width: 100%; height: 100%; object-fit: cover; }
    /* The featured shot opens the post as a hero: wider crop, softer frame. */
    article.post > figure.kg-card:first-of-type { aspect-ratio: 16 / 9; margin: 6px 0 26px; }
    /* Tables scroll horizontally instead of clipping, and never shift layout. */
    article.post .table-scroll { overflow-x: auto; margin: 20px 0; -webkit-overflow-scrolling: touch; }
    article.post table { width: 100%; border-collapse: collapse; font-size: 16px; margin: 20px 0; }
    article.post .table-scroll table { margin: 0; }
    article.post th, article.post td { border: 1px solid var(--line); padding: 9px 11px; text-align: left; vertical-align: top; }
    article.post thead th { font-family: "Outfit", "Avenir Next", sans-serif; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; background: #efe6d2; }
    article.post tbody tr:nth-child(even) td { background: #faf5ea; }
    article.post blockquote { margin: 20px 0; padding: 12px 18px; border-left: 4px solid #d9cdb4; background: var(--card); border-radius: 0 12px 12px 0; color: var(--muted); font-style: italic; }
    article.post blockquote p:last-child { margin-bottom: 0; }
    article.post pre { margin: 20px 0; padding: 15px 17px; overflow-x: auto; background: #f4efe3; border: 1px solid var(--line); border-radius: 12px; line-height: 1.5; }
    article.post code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; background: #efe6d2; border-radius: 4px; padding: 1px 5px; }
    article.post pre code { display: block; background: none; padding: 0; font-size: 14px; white-space: pre; }
    article.post figure.code-block { margin: 20px 0; }
    article.post figure.code-block figcaption { font-family: "Outfit", "Avenir Next", sans-serif; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); margin: 0 0 4px; }
    article.post figure.code-block pre { margin: 0; }
    article.post aside.callout { margin: 20px 0; padding: 13px 17px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
    article.post aside.callout .callout-title { margin: 0 0 6px; font-family: "Outfit", "Avenir Next", sans-serif; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; }
    article.post aside.callout p:last-child { margin-bottom: 0; }
    article.post aside.callout-note, article.post aside.callout-important { border-left: 4px solid var(--accent); }
    article.post aside.callout-tip { border-left: 4px solid #2f6b3a; }
    article.post aside.callout-warning { border-left: 4px solid #b45309; }
    article.post aside.callout-caution { border-left: 4px solid #b91c1c; }
    article.post .footnotes { margin-top: 30px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 14px; }
    article.post .footnotes ol { padding-left: 20px; }
    article.post sup.fn-ref a { text-decoration: none; }
    .byline { display: flex; gap: 14px; align-items: flex-start; margin: 20px 0 8px; padding: 16px; border: 1px solid var(--line); border-radius: 16px; background: var(--card); }
    .byline img { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; flex: none; box-shadow: 0 8px 18px -12px rgba(34, 24, 6, 0.6); }
    .byline .badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .byline .badges span { font-family: "Outfit", "Avenir Next", sans-serif; font-size: 11px; letter-spacing: 0.04em; border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; color: var(--muted); background: var(--bg); }
    /* Rule 6 ad slots: empty slots collapse and cannot shift layout. */
    .ad-slot { margin: 20px 0; }
    .ad-slot:empty { display: none; margin: 0; }
    .ad-slot-label { display: block; font-family: "Outfit", "Avenir Next", sans-serif; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); border: 1px dashed #d9cdb4; border-radius: 10px; padding: 10px 12px; text-align: center; background: var(--card); }
    .ad-rail { display: none; }
    @media (min-width: 1200px) {
      .post-layout { display: grid; grid-template-columns: minmax(0, 720px) 300px; gap: 32px; align-items: start; }
      .post-layout article.post { width: 100%; }
      .ad-rail { display: block; width: 300px; position: sticky; top: 24px; }
    }
  `}function R(e,t){let n=t.split(`/`).pop()??``;return`${e?`../../`:``}assets/img/${n}`}function z(e){let t=e.ads;return t?.length?i.map(e=>t.find(t=>t.id===e)??c().find(t=>t.id===e)):c()}function B(e){return new TextEncoder().encode(e).length<=a}function V(e){let t=z(e).map(e=>`${e.id}:${+!!e.enabled}:${e.adType}:${e.code.length}:${e.code}`).join(`|`);return Z(`ads:${+!!e.adsEnabled}:${t}`)}function H(e){let t=z(e).some(e=>e.enabled&&e.adType===`adsense_responsive`&&e.code.trim());return!e.adsEnabled||!t?``:`<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-placeholder" crossorigin="anonymous"><\/script>`}function U(e,t,r=!1){let i=z(e).find(e=>e.id===t),a=r?`<span class="ad-slot-label">Ad slot · ${n(i.name)} · ${n(i.adType===`adsense_responsive`?`AdSense responsive`:`custom code`)}${i.enabled?``:` · disabled`}</span>`:!e.adsEnabled||!i.enabled||!i.code.trim()?``:B(i.code)?i.adType===`adsense_responsive`?`<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-placeholder" data-ad-slot="${n(i.code.trim())}" data-ad-format="auto" data-full-width-responsive="true"></ins>`:i.code:`<!-- ad-slot:${t} rejected: code exceeds the 16 KiB limit -->`;return`<div data-ad-slot="${t}" class="ad-slot${t===`article_sidebar`?` ad-rail`:``}">${a}</div>`}function W(e){return(e.match(/<\/p>/gi)??[]).length>=6}function G(e,t,n=!1){if(!t||!n&&!W(e))return e;let r=0,i=0;for(;r<3;){let n=e.indexOf(`</p>`,i);if(n<0)return e;if(r+=1,i=n+4,r===3)return`${e.slice(0,i)}\n${t}\n${e.slice(i)}`}return e}function K(e){let t=e.origin,n=e.author,r=n?{"@type":`Person`,name:n.name,jobTitle:n.role,description:n.shortBio,image:n.avatarUrl,knowsAbout:n.expertise,homeLocation:{"@type":`Place`,name:`${n.city}, ${n.region}, US`},url:`${t}/author/${n.slug}/`}:{"@type":`Person`,name:e.site.authors||e.site.staticName};return JSON.stringify({"@context":`https://schema.org`,"@type":`Article`,headline:e.article.metaTitle||e.article.title,description:e.article.metaDescription||e.article.excerpt,datePublished:new Date(e.article.publishedAt).toISOString(),inLanguage:`en-US`,keywords:[e.article.keyword],mainEntityOfPage:`${t}/post/${e.article.slug}/`,author:r})}function q(e,t=52){let r=I(M(e.avatarUrl)??e.id,e.name,96).replace(/'/g,`%27`);return`<img src="${n(e.avatarUrl)}" alt="Portrait of ${n(e.name)}" width="${t}" height="${t}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${r}'" />`}function J(e,t){if(!e)return``;let r=e.expertise.map(e=>`<span>${n(e)}</span>`).join(``);return`<div class="byline">
  ${q(e)}
  <div>
    <a class="meta" href="${n(t)}/author/${n(e.slug)}/">${n(e.name)}</a>
    <div class="meta">${n(e.role)} · ${n(e.city)}, ${n(e.region)} · ${e.articleCount}/${e.maxArticles} articles</div>
    <p style="margin:6px 0 0; font-size: 15px;">${n(e.shortBio)}</p>
    <div class="badges">${r}</div>
  </div>
</div>`}function Y(e,t,r,i=[],a={}){let o=!!a.adsPreview,s=e.publicUrl.replace(/\/$/,``),c=t.filter(t=>t.siteId===e.id),l=e=>i.find(t=>t.id===e.authorId),u=r?`\n${e.headHtml}\n`:``,d=r?`\n${e.bodyEnd}\n${e.analyticsSnippet}\n`:``,f=o?``:H(e),p=t=>U(e,t,o),m=c.length>=7?p(`home_feed`):``,h=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${n(e.staticName)}</title>
<link rel="canonical" href="${n(s)}/">
<meta name="robots" content="${n(e.robots)}">
<link rel="stylesheet" href="assets/site.css">${f}${u}
</head>
<body>
${p(`site_top`)}
<header><a class="mark" href="./">${n(e.staticName)}</a><span class="meta">${n(e.authors)}</span></header>
<main>
  <h1>${n(e.staticName)}</h1>
  <p>${n(e.footer)}</p>
  <div class="grid">
    ${c.slice(0,6).map(e=>{let t=e.images.find(e=>e.role===`featured`)??e.images[0],r=t?`<img src="${n(S(t,e.keyword||e.title))}" alt="${n(t.alt||e.title)}" width="474" height="274" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`:``;return`<a class="card" href="./post/${n(e.slug)}/">${r}<span class="meta">${n(e.keyword)}</span><strong>${n(e.title)}</strong></a>`}).join(`
`)}
    ${m}
    ${c.slice(6).map(e=>{let t=e.images.find(e=>e.role===`featured`)??e.images[0],r=t?`<img src="${n(S(t,e.keyword||e.title))}" alt="${n(t.alt||e.title)}" width="474" height="274" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`:``;return`<a class="card" href="./post/${n(e.slug)}/">${r}<span class="meta">${n(e.keyword)}</span><strong>${n(e.title)}</strong></a>`}).join(`
`)}
  </div>
</main>
<footer>${n(e.footer)}</footer>
${p(`site_bottom`)}
${d}
</body></html>`,g=[{name:`assets/site.css`,text:L()},{name:`index.html`,text:h}];for(let t of c){let r=D(t.html,e=>R(!0,e)),i=l(t),a=K({site:e,article:t,author:i,origin:s}),c=t.images.find(e=>e.role===`featured`)??t.images[0],m=c?S(c,t.keyword||t.title):``,h=[`<meta property="og:type" content="article">`,`<meta property="og:title" content="${n(t.metaTitle||t.title)}">`,`<meta property="og:description" content="${n(t.metaDescription||t.excerpt)}">`,`<meta name="theme-color" content="#f7f3ea">`,m?`<meta property="og:image" content="${n(m)}">`:``,m?`<meta name="twitter:card" content="summary_large_image">`:``].filter(Boolean).join(`
`),_=G(r,p(`article_inline`),o);g.push({name:`post/${t.slug}/index.html`,text:`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${n(t.metaTitle||t.title)} · ${n(e.staticName)}</title>
<link rel="canonical" href="${n(s)}/post/${n(t.slug)}/">
<meta name="description" content="${n(t.metaDescription||t.excerpt)}">
<meta name="robots" content="${n(e.robots)}">
${h}
<script type="application/ld+json">${a}<\/script>
<link rel="stylesheet" href="../../assets/site.css">${f}${u}
</head>
<body>
${p(`site_top`)}
<header><a class="mark" href="../../">${n(e.staticName)}</a><span class="meta">${n(t.status)}</span></header>
<main>
<div class="post-layout">
<article class="post">
  ${p(`article_top`)}
  <p class="meta">${n(t.keyword)}</p>
  <h1>${n(t.title)}</h1>
  ${J(i,s)}
  ${_}
  ${p(`article_bottom`)}
</article>
${p(`article_sidebar`)}
</div>
</main>
<footer>${n(e.footer)}</footer>
${p(`site_bottom`)}
${d}
</body></html>`})}for(let t of i){let r=c.filter(e=>e.authorId===t.id);if(!r.length)continue;let i=JSON.stringify({"@context":`https://schema.org`,"@type":`Person`,name:t.name,jobTitle:t.role,description:t.shortBio,image:t.avatarUrl,knowsAbout:t.expertise,homeLocation:{"@type":`Place`,name:`${t.city}, ${t.region}, US`},url:`${s}/author/${t.slug}/`});g.push({name:`author/${t.slug}/index.html`,text:`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${n(t.name)} · ${n(e.staticName)}</title>
<link rel="canonical" href="${n(s)}/author/${n(t.slug)}/">
<meta name="robots" content="${n(e.robots)}">
<script type="application/ld+json">${i}<\/script>
<link rel="stylesheet" href="../../assets/site.css">
</head>
<body>
<header><a class="mark" href="../../">${n(e.staticName)}</a><span class="meta">Author</span></header>
<main>
  <div class="byline" style="max-width: 720px;">
    ${q(t)}
    <div>
      <h1 style="font-size: 30px; margin: 0;">${n(t.name)}</h1>
      <div class="meta">${n(t.role)} · ${n(t.city)}, ${n(t.region)}, US · ${t.articleCount}/${t.maxArticles} articles</div>
      <p style="margin: 8px 0 0;">${n(t.shortBio)}</p>
      <div class="badges">${t.expertise.map(e=>`<span>${n(e)}</span>`).join(``)}</div>
    </div>
  </div>
  <div class="grid" style="margin-top: 24px;">
    ${r.map(e=>`<a class="card" href="../../post/${n(e.slug)}/"><span class="meta">${n(e.keyword)}</span><strong>${n(e.title)}</strong></a>`).join(`
`)}
  </div>
</main>
<footer>${n(e.footer)}</footer>
</body></html>`})}let _=[`${s}/`,...c.map(e=>`${s}/post/${e.slug}/`),...i.map(e=>`${s}/author/${e.slug}/`)];g.push({name:`sitemap.xml`,text:`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${_.map(e=>`  <url><loc>${n(e)}</loc></url>`).join(`
`)}\n</urlset>\n`}),g.push({name:`robots.txt`,text:e.robots.startsWith(`noindex`)?`User-agent: *
Disallow: /
`:`User-agent: *\nAllow: /\nSitemap: ${s}/sitemap.xml\n`});let v=Q(e.indexNowKey??``);v&&g.push(v);let y=(e.adsTxt??``).trim();return y&&g.push({name:`ads.txt`,text:`${y}\n`}),g}function X(e){let t=new Set;for(let n of e)n.name===`index.html`?t.add(`/`):n.name.endsWith(`/index.html`)?t.add(`/${n.name.slice(0,-10)}`):/\.(txt|xml)$/i.test(n.name)&&t.add(`/${n.name}`);return[...t].sort()}function Z(e){let t=2166136261;for(let n=0;n<e.length;n++)t=Math.imul(t^e.charCodeAt(n),16777619);return(t>>>0).toString(16).padStart(8,`0`)}function Q(e){return/^[a-zA-Z0-9-]{8,128}$/.test(e)?{name:`${e}.txt`,text:e}:null}function $(e){let t=new Set,n=[];for(let r of e)for(let e of E(r.html)){if(t.has(e))continue;t.add(e);let i=r.images.find(t=>t.src?.endsWith(e));n.push({name:e,remote:i?.remote})}return n}var ee=t({method:`POST`}).handler(e(`72411befe807a697430999c9a0e7fe15c0c283d27fdcbe33022a361f880225d2`)),te=t({method:`POST`}).handler(e(`aa779ce342c918b49010f0d8081196c3a91885cd6f69519f9eff6fb2e06dfa75`));export{p as A,o as C,u as D,f as E,r as O,i as S,d as T,_,X as a,x as b,Y as c,M as d,A as f,S as g,T as h,V as i,c as k,$ as l,I as m,te as n,Z as o,j as p,B as r,z as s,ee as t,N as u,v,l as w,a as x,b as y};