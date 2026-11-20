/**
 * Windows-only workaround: OpenNext's `patch-next-server` (removeMiddlewareManifestRule) does not
 * apply when building on win32, leaving `require(this.middlewareManifestPath)` in the bundle,
 * which workerd rejects ("Dynamic require of …/middleware-manifest.json is not supported").
 * We apply the same fix upstream applies on Linux: the method returns null. No-op elsewhere.
 */
import { readFileSync, writeFileSync } from "node:fs";

const file = ".open-next/server-functions/default/handler.mjs";
const src = readFileSync(file, "utf8");
const re = /getMiddlewareManifest\(\)\{return this\.minimalMode\?null:require\(this\.middlewareManifestPath\)\}/g;
const n = (src.match(re) ?? []).length;
if (n) writeFileSync(file, src.replace(re, "getMiddlewareManifest(){return null}"));
console.log(`patch-opennext-win: ${n} occorrenze sostituite`);
