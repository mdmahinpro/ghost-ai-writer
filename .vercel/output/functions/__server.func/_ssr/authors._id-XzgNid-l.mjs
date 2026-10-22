import { C as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as Route$10 } from "./router-DMHI1rJE.mjs";
import { n as AuthorDetail } from "./authors-D2pc4RAf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/authors._id-XzgNid-l.js
var import_jsx_runtime = require_jsx_runtime();
var SplitComponent = function AuthorRoute() {
	const { id } = Route$10.useParams();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthorDetail, { id });
};
//#endregion
export { SplitComponent as component };
