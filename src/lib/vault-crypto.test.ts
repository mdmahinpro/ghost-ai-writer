import assert from "node:assert/strict";
import { adoptKey, clearSessionKey, createVaultMeta, openState, passphraseMatches, sealState } from "./vault-crypto.ts";

const passphrase = "northline-vault-pass";
const plain = JSON.stringify({ name: "gaw-v2", secret: "studio-marker-northline" });

const { meta, key } = await createVaultMeta(passphrase);
const encoded = JSON.stringify(meta);
assert.equal(encoded.includes(passphrase), false);
assert.equal(meta.v, 1);
assert.ok(meta.salt && meta.verifier && meta.iv);

adoptKey(key);
const sealed = await sealState(plain);
assert.equal(sealed.startsWith("gaw1."), true);
assert.equal(sealed.includes("studio-marker-northline"), false);
assert.throws(() => JSON.parse(sealed));

clearSessionKey();
assert.equal(await openState(sealed), null);

const wrong = await passphraseMatches("not-the-passphrase", meta);
assert.equal(wrong, null);

const openedKey = await passphraseMatches(passphrase, meta);
assert.ok(openedKey);
adoptKey(openedKey!);
assert.equal(await openState(sealed), plain);

console.log("vault ok: ciphertext is not JSON and a wrong passphrase does not open it");
