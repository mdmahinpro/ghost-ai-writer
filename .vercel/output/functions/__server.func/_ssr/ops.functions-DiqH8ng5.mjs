import { J as indexNowKeyFile, Q as isPrivateHost } from "./engine-DWsB6FrJ.mjs";
import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
import net from "node:net";
import tls from "node:tls";
import { Client } from "ssh2";
//#region node_modules/.nitro/vite/services/ssr/assets/ops.functions-DiqH8ng5.js
var SFTP_PORT = 65002;
function connect(host, user, password) {
	return new Promise((resolve, reject) => {
		const client = new Client();
		const timer = setTimeout(() => {
			client.end();
			reject(/* @__PURE__ */ new Error("SFTP on port 65002 did not answer."));
		}, 1e4);
		client.once("ready", () => {
			clearTimeout(timer);
			resolve(client);
		});
		client.once("error", (error) => {
			clearTimeout(timer);
			client.end();
			reject(error);
		});
		client.connect({
			host,
			port: SFTP_PORT,
			username: user,
			password,
			readyTimeout: 1e4
		});
	});
}
function session(host, user, password, run) {
	return connect(host, user, password).then((client) => new Promise((resolve, reject) => {
		client.sftp((error, sftp) => {
			if (error || !sftp) {
				client.end();
				reject(error ?? /* @__PURE__ */ new Error("SFTP session did not open."));
				return;
			}
			run(sftp).then((value) => {
				client.end();
				resolve(value);
			}, (failure) => {
				client.end();
				reject(failure);
			});
		});
	}));
}
function sftpList(host, user, password, path) {
	const target = !path || path === "/" ? "." : path.replace(/^\/+/, "");
	return session(host, user, password, (sftp) => {
		return new Promise((resolve, reject) => {
			sftp.readdir(target, (error, list) => {
				if (error) reject(error);
				else resolve((list ?? []).map((entry) => entry.filename).join("\n"));
			});
		});
	});
}
function mkdir(sftp, dir) {
	return new Promise((resolve) => {
		sftp.mkdir(dir, () => resolve());
	});
}
function writeFile(sftp, name, bytes) {
	return new Promise((resolve, reject) => {
		sftp.writeFile(name, bytes, (error) => {
			if (error) reject(error);
			else resolve();
		});
	});
}
function sftpUpload(host, user, password, path, files) {
	const root = !path || path === "/" ? "" : path.replace(/^\/+|\/+$/g, "");
	return session(host, user, password, async (sftp) => {
		const made = /* @__PURE__ */ new Set();
		for (const file of files) {
			const name = root ? `${root}/${file.name}` : file.name;
			const parts = name.split("/").slice(0, -1);
			let dir = "";
			for (const part of parts) {
				dir = dir ? `${dir}/${part}` : part;
				if (made.has(dir)) continue;
				await mkdir(sftp, dir);
				made.add(dir);
			}
			await writeFile(sftp, name, Buffer.from(file.base64, "base64"));
		}
		return files.length;
	});
}
function safe(error) {
	return (error instanceof Error ? error.message : "Request failed.").replace(/PASS\s+\S+/gi, "PASS •••").slice(0, 320);
}
async function publicHost(host) {
	if (!host || host.includes("/") || isPrivateHost(host)) throw new Error("That host is not allowed.");
	const records = await (await import("node:dns/promises")).lookup(host, { all: true });
	for (const record of records) {
		const address = record.address.toLowerCase().replace(/^::ffff:/, "");
		if (isPrivateHost(address) || address === "::1") throw new Error("That host resolves to a private address.");
	}
}
function withTimeout(work, ms, message) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(message)), ms);
		work.then((value) => {
			clearTimeout(timer);
			resolve(value);
		}, (error) => {
			clearTimeout(timer);
			reject(error);
		});
	});
}
function armSocket(socket, ms, message) {
	socket.setTimeout(ms);
	socket.once("timeout", () => socket.destroy(new Error(message)));
}
function readReply(socket) {
	return new Promise((resolve, reject) => {
		let buf = "";
		const timer = setTimeout(() => {
			socket.off("data", onData);
			reject(/* @__PURE__ */ new Error("FTP timed out."));
		}, 8e3);
		const onData = (chunk) => {
			buf += chunk.toString("utf8");
			const lines = buf.split(/\r?\n/).filter(Boolean);
			const last = lines[lines.length - 1] ?? "";
			if (/^\d{3} /.test(last)) {
				clearTimeout(timer);
				socket.off("data", onData);
				resolve(buf.trim());
			}
		};
		socket.on("data", onData);
	});
}
async function loginFtp(secure, user, password) {
	const names = user.endsWith(".com") ? [user, user.slice(0, -4)] : [user];
	let last = "530 Login incorrect.";
	for (const name of names) {
		secure.write(`USER ${name}\r\n`);
		const userReply = await readReply(secure);
		if (userReply.includes("230")) return name;
		if (!userReply.includes("331")) {
			last = userReply.split(/\r?\n/).filter(Boolean).pop() ?? last;
			continue;
		}
		secure.write(`PASS ${password}\r\n`);
		const passReply = await readReply(secure);
		if (passReply.includes("230")) return name;
		last = (passReply.split(/\r?\n/).filter(Boolean).pop() ?? last).replace(/PASS\s+\S+/gi, "PASS");
	}
	throw new Error(`FTP rejected the password for ${user}. ${last} Hostinger shows a .com on the account name, but the login is the same name without .com.`);
}
var submitIndexNow_createServerFn_handler = createServerRpc({
	id: "25980ead25f5600f9d4d7e4ca2f8868c428cfc4aad2622aa6a5e924ddecbf95e",
	name: "submitIndexNow",
	filename: "src/lib/ops.functions.ts"
}, (opts) => submitIndexNow.__executeServer(opts));
var submitIndexNow = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input;
	const publicUrl = String(raw?.publicUrl ?? "").trim();
	const key = String(raw?.key ?? "").trim();
	const urls = Array.isArray(raw?.urls) ? raw.urls.map((url) => String(url)).slice(0, 100) : [];
	if (!/^https:\/\//.test(publicUrl)) throw new Error("Set a public https URL before submitting IndexNow.");
	if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error("IndexNow key must be 8–128 letters, numbers, or dashes.");
	if (!urls.length) throw new Error("There are no article URLs to submit.");
	const ftp = raw?.ftp;
	return {
		publicUrl: publicUrl.replace(/\/$/, ""),
		key,
		urls,
		verified: raw?.verified === true,
		ftp: {
			host: String(ftp?.host ?? "").trim(),
			user: String(ftp?.user ?? "").trim(),
			password: String(ftp?.password ?? ""),
			port: Number(ftp?.port ?? 21) || 21,
			path: String(ftp?.path ?? "/").trim() || "/",
			via: ftp?.via === "sftp" ? "sftp" : "ftps"
		}
	};
}).handler(submitIndexNow_createServerFn_handler, async ({ data }) => {
	try {
		if (!data.verified || !data.ftp.host || !data.ftp.user || !data.ftp.password) return {
			ok: false,
			status: 0,
			error: "cPanel hosting is not verified. Verify Explicit-TLS FTPS on Connections before submitting IndexNow. Bing was not called."
		};
		const file = indexNowKeyFile(data.key);
		if (!file) return {
			ok: false,
			status: 0,
			error: "IndexNow key must be 8–128 letters, numbers, or dashes."
		};
		const origin = new URL(data.publicUrl);
		if (data.ftp.host !== "preview-cpanel") await publicHost(origin.hostname);
		const uploaded = await uploadFtps({ data: {
			host: data.ftp.host,
			user: data.ftp.user,
			password: data.ftp.password,
			port: data.ftp.port,
			path: data.ftp.path,
			via: data.ftp.via,
			files: [{
				name: file.name,
				base64: Buffer.from(file.text, "utf8").toString("base64")
			}]
		} });
		if (!uploaded.ok) return {
			ok: false,
			status: 0,
			error: `The key file was not uploaded. ${uploaded.error} Bing was not called.`
		};
		const keyLocation = `${data.publicUrl}/${file.name}`;
		if (data.ftp.host !== "preview-cpanel") {
			const probe = await fetch(keyLocation, {
				redirect: "manual",
				cache: "no-store",
				signal: AbortSignal.timeout(8e3)
			});
			if (probe.status >= 300 && probe.status < 400) return {
				ok: false,
				status: probe.status,
				error: `The key file at ${keyLocation} redirected. Bing was not called.`
			};
			const body = probe.status === 200 ? (await probe.text()).trim() : "";
			if (probe.status !== 200 || body !== data.key) return {
				ok: false,
				status: probe.status,
				error: `The key file at ${keyLocation} did not return the key (HTTP ${probe.status}). Bing was not called.`
			};
		} else if (file.text.trim() !== data.key) return {
			ok: false,
			status: 0,
			error: "The key file contents do not match the IndexNow key. Bing was not called."
		};
		if (data.ftp.host === "preview-cpanel") return {
			ok: true,
			status: 200,
			keyLocation
		};
		const response = await fetch("https://api.indexnow.org/indexnow", {
			method: "POST",
			redirect: "manual",
			signal: AbortSignal.timeout(15e3),
			headers: { "Content-Type": "application/json; charset=utf-8" },
			body: JSON.stringify({
				host: origin.hostname,
				key: data.key,
				keyLocation,
				urlList: data.urls
			})
		});
		if (response.status >= 300 && response.status < 400) return {
			ok: false,
			status: response.status,
			error: "IndexNow redirected. Blocked."
		};
		if (response.ok || response.status === 202) return {
			ok: true,
			status: response.status,
			keyLocation
		};
		return {
			ok: false,
			status: response.status,
			error: `IndexNow returned HTTP ${response.status}.`
		};
	} catch (error) {
		return {
			ok: false,
			status: 0,
			error: safe(error)
		};
	}
});
function pushStep(steps, name, started, ok, detail) {
	steps.push({
		name,
		ok,
		ms: Date.now() - started,
		detail
	});
}
function tlsOptions(host, session) {
	return {
		rejectUnauthorized: false,
		minVersion: "TLSv1.2",
		maxVersion: "TLSv1.2",
		servername: /^\d+\.\d+\.\d+\.\d+$/.test(host) ? void 0 : host,
		session
	};
}
function parsePasv(reply, fallbackHost) {
	const match = reply.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
	if (!match) return null;
	const ip = `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
	const port = Number(match[5]) * 256 + Number(match[6]);
	return {
		host: isPrivateHost(ip) ? fallbackHost : ip,
		port
	};
}
var testFtpLogin_createServerFn_handler = createServerRpc({
	id: "7035dde062bc4ed17990b489a4ddcd6cf4146a22d751403aaab6282292abcd31",
	name: "testFtpLogin",
	filename: "src/lib/ops.functions.ts"
}, (opts) => testFtpLogin.__executeServer(opts));
var testFtpLogin = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input;
	const host = String(raw?.host ?? "").trim();
	const user = String(raw?.user ?? "").trim();
	const password = String(raw?.password ?? "");
	const path = String(raw?.path ?? "/").trim().replace(/^\/?public_html$/, "/") || "/";
	const port = Number(raw?.port ?? 21) || 21;
	if (!host || !user || !password) throw new Error("Host, username, and password are required.");
	if (user.length > 80 || password.length > 200 || host.length > 200) throw new Error("FTP fields are too long.");
	if (port < 1 || port > 65535) throw new Error("FTP port is not valid.");
	return {
		host,
		user,
		password,
		port,
		path
	};
}).handler(testFtpLogin_createServerFn_handler, async ({ data }) => {
	const steps = [];
	let plain = null;
	let secure = null;
	try {
		pushStep(steps, "CONFIG", Date.now(), true, "host, username, password and remote path present");
		const dnsStarted = Date.now();
		await publicHost(data.host);
		pushStep(steps, "DNS", dnsStarted, true, "resolves to a public address");
		const tcpStarted = Date.now();
		plain = net.connect({
			host: data.host,
			port: data.port,
			timeout: 8e3
		});
		armSocket(plain, 8e3, "Could not reach that host on the FTP port. Check the hostname and port.");
		const greetingPromise = readReply(plain);
		await new Promise((resolve, reject) => {
			plain.once("connect", () => resolve());
			plain.once("error", reject);
		});
		const hello = await greetingPromise;
		if (!/^220/.test(hello)) throw new Error("The server did not greet as FTP.");
		pushStep(steps, "TCP", tcpStarted, true, "connected; server says 220 FTP ready");
		const tlsStarted = Date.now();
		plain.write("AUTH TLS\r\n");
		if (!(await readReply(plain)).includes("234")) throw new Error("This host does not offer explicit TLS on that port.");
		secure = tls.connect({
			socket: plain,
			...tlsOptions(data.host)
		});
		armSocket(secure, 8e3, "Explicit TLS started, but the handshake did not finish.");
		await withTimeout(new Promise((resolve, reject) => {
			secure.once("secureConnect", () => resolve());
			secure.once("error", reject);
		}), 8e3, "Explicit TLS started, but the handshake did not finish.");
		pushStep(steps, "TLS", tlsStarted, true, "explicit TLS established");
		const authStarted = Date.now();
		const account = await loginFtp(secure, data.user, data.password);
		data.user = account;
		pushStep(steps, "AUTH", authStarted, true, `the FTP account accepted ${account}`);
		const settingsStarted = Date.now();
		secure.write("PBSZ 0\r\n");
		await readReply(secure);
		secure.write("PROT P\r\n");
		if (!(await readReply(secure)).includes("200")) throw new Error("The server refused a protected data channel.");
		pushStep(steps, "SETTINGS", settingsStarted, true, "protected data channel negotiated");
		const listStarted = Date.now();
		let listing = "";
		try {
			secure.write("PASV\r\n");
			const endpoint = parsePasv(await readReply(secure), data.host);
			if (!endpoint) throw new Error("The server did not open a passive port.");
			if (data.path === "public_html" || data.path === "/public_html") data.path = "/";
			listing = await listProtected(endpoint.host, endpoint.port, secure, data.path);
		} catch (error) {
			try {
				const entries = (await sftpList(data.host, data.user, data.password, data.path)).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length;
				pushStep(steps, "LIST", listStarted, true, `${entries} entries over SFTP port 65002. Passive FTP is blocked, so files use SFTP.`);
				secure.write("QUIT\r\n");
				secure.end();
				return {
					ok: true,
					steps,
					via: "sftp",
					user: data.user,
					banner: `cPanel verified over SFTP (${data.host}:65002, ${data.path} readable). Passive FTP ports are blocked.`
				};
			} catch (sftpError) {
				pushStep(steps, "LIST", listStarted, false, safe(error));
				const mainUser = data.user.includes(".") ? data.user.split(".")[0] : "";
				const hint = mainUser ? ` Try the main Hostinger username ${mainUser} on port 65002, or upload the ZIP in hPanel → Files → File Manager → public_html.` : " Upload the ZIP in hPanel → Files → File Manager → public_html.";
				throw new Error(`Signed in on FTP, but the data port is blocked and SFTP on port 65002 refused this user (${safe(sftpError)}).${hint}`);
			}
		}
		const entries = listing.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length;
		pushStep(steps, "LIST", listStarted, true, `${entries} entries readable in ${data.path}`);
		secure.write("QUIT\r\n");
		secure.end();
		return {
			ok: true,
			steps,
			via: "ftps",
			user: data.user,
			banner: `cPanel verified over FTPS (${data.host}:${data.port}, ${data.path} readable)`
		};
	} catch (error) {
		const failed = steps.some((step) => !step.ok) ? steps : [...steps, {
			name: "STOP",
			ok: false,
			ms: 0,
			detail: safe(error)
		}];
		try {
			secure?.destroy();
			plain?.destroy();
		} catch {}
		return {
			ok: false,
			error: safe(error),
			steps: failed
		};
	}
});
var uploadFtps_createServerFn_handler = createServerRpc({
	id: "4b8bced8c898c4993e854eb28105979a4f40b3f754800edea8e869e0cbc5ad94",
	name: "uploadFtps",
	filename: "src/lib/ops.functions.ts"
}, (opts) => uploadFtps.__executeServer(opts));
var uploadFtps = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input;
	const host = String(raw?.host ?? "").trim();
	const user = String(raw?.user ?? "").trim();
	const password = String(raw?.password ?? "");
	const path = String(raw?.path ?? "/").trim().replace(/^\/?public_html$/, "/") || "/";
	const port = Number(raw?.port ?? 21) || 21;
	const files = Array.isArray(raw?.files) ? raw.files : [];
	if (!host || !user || !password) throw new Error("Host, username, and password are required.");
	if (!files.length) throw new Error("There are no files to upload.");
	if (files.length > 80) throw new Error("Too many files for one upload.");
	const clean = files.map((file) => {
		const name = String(file?.name ?? "").replace(/^\/+/, "");
		if (!name || name.includes("..") || !/^[a-zA-Z0-9._/-]+$/.test(name)) throw new Error("A file path is not safe to upload.");
		const base64 = String(file?.base64 ?? "");
		if (base64.length > 2e6) throw new Error(`${name} is too large to upload from this panel.`);
		return {
			name,
			base64
		};
	});
	return {
		host,
		user,
		password,
		port,
		path,
		via: raw?.via === "sftp" ? "sftp" : "ftps",
		files: clean
	};
}).handler(uploadFtps_createServerFn_handler, async ({ data }) => {
	if (data.host === "preview-cpanel") return {
		ok: true,
		files: data.files.length
	};
	let plain = null;
	let secure = null;
	try {
		if (data.via === "sftp") return {
			ok: true,
			files: await sftpUpload(data.host, data.user, data.password, data.path, data.files)
		};
		await publicHost(data.host);
		plain = net.connect({
			host: data.host,
			port: data.port,
			timeout: 8e3
		});
		armSocket(plain, 8e3, "Could not reach that host on the FTP port. Check the hostname and port.");
		const greetingPromise = readReply(plain);
		await new Promise((resolve, reject) => {
			plain.once("connect", () => resolve());
			plain.once("error", reject);
		});
		const hello = await greetingPromise;
		if (!/^220/.test(hello)) throw new Error("The server did not greet as FTP.");
		plain.write("AUTH TLS\r\n");
		if (!(await readReply(plain)).includes("234")) throw new Error("This host does not offer explicit TLS on that port.");
		secure = tls.connect({
			socket: plain,
			...tlsOptions(data.host)
		});
		armSocket(secure, 8e3, "Explicit TLS started, but the handshake did not finish.");
		await withTimeout(new Promise((resolve, reject) => {
			secure.once("secureConnect", () => resolve());
			secure.once("error", reject);
		}), 8e3, "Explicit TLS started, but the handshake did not finish.");
		data.user = await loginFtp(secure, data.user, data.password);
		secure.write("PBSZ 0\r\n");
		await readReply(secure);
		secure.write("PROT P\r\n");
		if (!(await readReply(secure)).includes("200")) throw new Error("The server refused a protected data channel.");
		secure.write("TYPE I\r\n");
		await readReply(secure);
		if (data.path && data.path !== "/") {
			secure.write(`CWD ${data.path}\r\n`);
			if (!(await readReply(secure)).includes("250")) throw new Error("Could not open the remote directory.");
		}
		const made = /* @__PURE__ */ new Set();
		for (const file of data.files) {
			const parts = file.name.split("/").slice(0, -1);
			let dir = "";
			for (const part of parts) {
				dir = dir ? `${dir}/${part}` : part;
				if (made.has(dir)) continue;
				secure.write(`MKD ${dir}\r\n`);
				await readReply(secure);
				made.add(dir);
			}
			await storeOne(data.host, secure, file.name, Buffer.from(file.base64, "base64"));
		}
		secure.write("QUIT\r\n");
		secure.end();
		return {
			ok: true,
			files: data.files.length
		};
	} catch (error) {
		try {
			secure?.destroy();
			plain?.destroy();
		} catch {}
		return {
			ok: false,
			error: safe(error)
		};
	}
});
function storeOne(host, control, name, bytes) {
	return new Promise((resolve, reject) => {
		(async () => {
			let raw = null;
			try {
				control.write("PASV\r\n");
				const endpoint = parsePasv(await readReply(control), host);
				if (!endpoint) throw new Error("The server did not open a passive port.");
				raw = net.connect({
					host: endpoint.host,
					port: endpoint.port,
					timeout: 8e3
				});
				armSocket(raw, 8e3, `Upload timed out for ${name}.`);
				await new Promise((ok, fail) => {
					raw.once("connect", () => ok());
					raw.once("error", fail);
				});
				const data = tls.connect({
					socket: raw,
					...tlsOptions(host, control.getSession() || void 0)
				});
				const timer = setTimeout(() => {
					data.destroy();
					reject(/* @__PURE__ */ new Error(`Upload timed out for ${name}.`));
				}, 2e4);
				let buf = "";
				const onControl = (chunk) => {
					buf += chunk.toString("utf8");
					if (/^550 /m.test(buf) || /\n550 /.test(buf)) {
						clearTimeout(timer);
						control.off("data", onControl);
						data.destroy();
						reject(/* @__PURE__ */ new Error(`The server refused ${name}.`));
						return;
					}
					if (/^226 /m.test(buf) || /\n226 /.test(buf)) {
						clearTimeout(timer);
						control.off("data", onControl);
						data.end();
						resolve();
					}
				};
				control.on("data", onControl);
				data.once("error", (error) => {
					clearTimeout(timer);
					control.off("data", onControl);
					reject(error instanceof Error ? error : /* @__PURE__ */ new Error("Data channel failed."));
				});
				control.write(`STOR ${name}\r\n`);
				data.once("secureConnect", () => data.end(bytes));
			} catch (error) {
				raw?.destroy();
				reject(error instanceof Error ? error : /* @__PURE__ */ new Error("Upload failed."));
			}
		})();
	});
}
function listProtected(host, port, control, path) {
	return new Promise((resolve, reject) => {
		const raw = net.connect({
			host,
			port,
			timeout: 8e3
		});
		armSocket(raw, 8e3, "The data connection did not open. Passive FTP ports may be blocked.");
		let body = "";
		let controlBuf = "";
		let settled = false;
		let data = null;
		const timer = setTimeout(() => finish(/* @__PURE__ */ new Error("Listing the remote directory timed out.")), 1e4);
		const finish = (error, value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			control.off("data", onControl);
			data?.destroy();
			raw.destroy();
			if (error) reject(error);
			else resolve(value ?? body);
		};
		const onControl = (chunk) => {
			controlBuf += chunk.toString("utf8");
			if (/^550 /m.test(controlBuf) || /\n550 /.test(controlBuf)) {
				finish(/* @__PURE__ */ new Error("The server refused to list that directory."));
				return;
			}
			if (/^226 /m.test(controlBuf) || /\n226 /.test(controlBuf)) finish(void 0, body);
		};
		control.on("data", onControl);
		raw.once("error", (error) => finish(error instanceof Error ? error : /* @__PURE__ */ new Error("Data channel failed.")));
		raw.once("connect", () => {
			const target = path.trim();
			control.write(!target || target === "/" ? "LIST\r\n" : `LIST ${target}\r\n`);
			data = tls.connect({
				socket: raw,
				...tlsOptions(host, control.getSession() || void 0)
			});
			data.on("data", (chunk) => {
				body += chunk.toString("utf8");
			});
			data.once("end", () => {
				if (/226 |150 |125 /.test(controlBuf) || body.length) finish(void 0, body);
			});
			data.once("error", (error) => finish(error instanceof Error ? error : /* @__PURE__ */ new Error("Data channel failed.")));
		});
	});
}
var DEPLOY_HOSTS = {
	cloudflare: "https://api.cloudflare.com",
	vercel: "https://api.vercel.com",
	github: "https://api.github.com"
};
function readDeployFiles(raw) {
	const list = Array.isArray(raw) ? raw : [];
	if (!list.length) return {
		files: [],
		error: "No files to deploy."
	};
	if (list.length > 400) return {
		files: [],
		error: "Refusing more than 400 files in one adapter deploy."
	};
	let total = 0;
	const files = [];
	for (const entry of list) {
		const file = entry;
		const name = typeof file?.name === "string" ? file.name.replace(/\\/g, "/").replace(/^\/+/, "") : "";
		const base64 = typeof file?.base64 === "string" ? file.base64 : "";
		if (!name || name.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(name)) return {
			files: [],
			error: `Unsafe file name in the deploy payload: ${name || "(empty)"}`
		};
		if (!/^[A-Za-z0-9+/=]+$/.test(base64)) return {
			files: [],
			error: `File ${name} is not valid base64.`
		};
		total += base64.length;
		files.push({
			name,
			base64
		});
	}
	if (total > 48e6) return {
		files: [],
		error: "Deploy payload exceeds the 32 MiB limit."
	};
	return { files };
}
function adapterError(error) {
	return {
		ok: false,
		error: safe(error)
	};
}
var deployCloudflarePages_createServerFn_handler = createServerRpc({
	id: "5050b75bb5c44306828d75d67dd88f1285a25b11a69a4629e44d81cdf586f410",
	name: "deployCloudflarePages",
	filename: "src/lib/ops.functions.ts"
}, (opts) => deployCloudflarePages.__executeServer(opts));
var deployCloudflarePages = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input;
	const accountId = typeof raw?.accountId === "string" ? raw.accountId.trim().slice(0, 64) : "";
	const token = typeof raw?.token === "string" ? raw.token.trim().slice(0, 256) : "";
	const projectName = typeof raw?.projectName === "string" ? raw.projectName.trim().replace(/[^a-z0-9-]/gi, "").slice(0, 64) : "";
	if (!token) throw new Error("A Cloudflare API token is required. Save it on Connections first.");
	if (!accountId || !projectName) throw new Error("Cloudflare needs the account id and the Pages project name.");
	const checked = readDeployFiles(raw?.files);
	if (checked.error) throw new Error(checked.error);
	return {
		accountId,
		token,
		projectName,
		files: checked.files
	};
}).handler(deployCloudflarePages_createServerFn_handler, async ({ data }) => {
	try {
		let lastError = "Cloudflare did not accept the deployment.";
		for (const branch of ["production"]) {
			const form = new FormData();
			const manifest = {};
			for (const file of data.files) {
				const key = file.name;
				manifest[`/${key}`] = key;
				form.append(key, new Blob([Buffer.from(file.base64, "base64")]), key);
			}
			form.append("manifest", JSON.stringify(manifest));
			form.append("branch", branch);
			const response = await fetch(`${DEPLOY_HOSTS.cloudflare}/client/v4/accounts/${encodeURIComponent(data.accountId)}/pages/projects/${encodeURIComponent(data.projectName)}/deployments`, {
				method: "POST",
				headers: { Authorization: `Bearer ${data.token}` },
				body: form,
				signal: AbortSignal.timeout(12e4)
			});
			if (response.status === 401 || response.status === 403) return {
				ok: false,
				error: "Cloudflare refused the API token (check Pages:Edit scope)."
			};
			if (!response.ok) {
				const text = await response.text();
				lastError = `Cloudflare returned HTTP ${response.status}: ${text.slice(0, 200)}`;
				continue;
			}
			const body = await response.json();
			return {
				ok: true,
				detail: `Cloudflare Pages deployment ${body.result?.id ?? "created"}.`,
				url: body.result?.url,
				files: data.files.length
			};
		}
		return {
			ok: false,
			error: lastError
		};
	} catch (error) {
		return adapterError(error);
	}
});
var deployVercel_createServerFn_handler = createServerRpc({
	id: "199ee62865b71b85b7a3914fa0cf3d358fe162f7b56f07d655052a34ef6ba442",
	name: "deployVercel",
	filename: "src/lib/ops.functions.ts"
}, (opts) => deployVercel.__executeServer(opts));
var deployVercel = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input;
	const token = typeof raw?.token === "string" ? raw.token.trim().slice(0, 256) : "";
	const projectName = typeof raw?.projectName === "string" ? raw.projectName.trim().replace(/[^a-z0-9-]/gi, "").slice(0, 64) : "";
	if (!token) throw new Error("A Vercel token is required. Save it on Connections first.");
	if (!projectName) throw new Error("Vercel needs the project name.");
	const checked = readDeployFiles(raw?.files);
	if (checked.error) throw new Error(checked.error);
	return {
		token,
		projectName,
		files: checked.files.slice(0, 100)
	};
}).handler(deployVercel_createServerFn_handler, async ({ data }) => {
	try {
		const response = await fetch(`${DEPLOY_HOSTS.vercel}/v13/deployments`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${data.token}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				name: data.projectName,
				target: "production",
				files: data.files.map((file) => ({
					file: file.name,
					data: file.base64,
					encoding: "base64"
				})),
				projectSettings: {
					framework: null,
					buildCommand: null,
					outputDirectory: null,
					installCommand: null
				}
			}),
			signal: AbortSignal.timeout(12e4)
		});
		if (response.status === 401 || response.status === 403) return {
			ok: false,
			error: "Vercel refused the token."
		};
		if (!response.ok) return {
			ok: false,
			error: `Vercel returned HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`
		};
		const body = await response.json();
		return {
			ok: true,
			detail: `Vercel deployment ${body.id ?? "created"}.`,
			url: body.url ? `https://${body.url}` : void 0,
			files: data.files.length
		};
	} catch (error) {
		return adapterError(error);
	}
});
var deployGithubPages_createServerFn_handler = createServerRpc({
	id: "646c0813e31122789fe7b94a525d34568d0302b6fc19f61f16c36d8e4f98975c",
	name: "deployGithubPages",
	filename: "src/lib/ops.functions.ts"
}, (opts) => deployGithubPages.__executeServer(opts));
var deployGithubPages = createServerFn({ method: "POST" }).validator((input) => {
	const raw = input;
	const token = typeof raw?.token === "string" ? raw.token.trim().slice(0, 256) : "";
	const repo = typeof raw?.repo === "string" ? raw.repo.trim().slice(0, 120) : "";
	const branch = typeof raw?.branch === "string" && raw.branch.trim() ? raw.branch.trim().replace(/[^A-Za-z0-9._/-]/g, "").slice(0, 64) : "gh-pages";
	if (!token) throw new Error("A GitHub token is required. Save it on Connections first.");
	if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo)) throw new Error("GitHub needs the repo as owner/name.");
	const checked = readDeployFiles(raw?.files);
	if (checked.error) throw new Error(checked.error);
	return {
		token,
		repo,
		branch,
		files: checked.files.slice(0, 120)
	};
}).handler(deployGithubPages_createServerFn_handler, async ({ data }) => {
	try {
		const headers = {
			Authorization: `Bearer ${data.token}`,
			Accept: "application/vnd.github+json",
			"Content-Type": "application/json",
			"User-Agent": "ghost-grok-static"
		};
		let written = 0;
		for (const file of data.files) {
			const path = file.name;
			const head = await fetch(`${DEPLOY_HOSTS.github}/repos/${data.repo}/contents/${path}?ref=${encodeURIComponent(data.branch)}`, {
				headers,
				signal: AbortSignal.timeout(3e4)
			});
			const sha = head.ok ? (await head.json()).sha : void 0;
			const put = await fetch(`${DEPLOY_HOSTS.github}/repos/${data.repo}/contents/${path}`, {
				method: "PUT",
				headers,
				body: JSON.stringify({
					message: `Deploy ${path}`,
					content: file.base64,
					branch: data.branch,
					...sha ? { sha } : {}
				}),
				signal: AbortSignal.timeout(3e4)
			});
			if (put.status === 401 || put.status === 403) return {
				ok: false,
				error: "GitHub refused the token (needs contents:write on that repo)."
			};
			if (!put.ok) return {
				ok: false,
				error: `GitHub returned HTTP ${put.status} while writing ${path}.`
			};
			written += 1;
		}
		return {
			ok: true,
			detail: `Pushed ${written} files to ${data.repo}@${data.branch}. GitHub Pages serves the branch after its own build.`,
			files: written
		};
	} catch (error) {
		return adapterError(error);
	}
});
//#endregion
export { deployCloudflarePages_createServerFn_handler, deployGithubPages_createServerFn_handler, deployVercel_createServerFn_handler, submitIndexNow_createServerFn_handler, testFtpLogin_createServerFn_handler, uploadFtps_createServerFn_handler };
