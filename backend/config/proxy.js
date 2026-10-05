"use strict";
function proxyTrust(value, production) {
  if (value === undefined || value === "") return production ? 1 : false;
  if (value === "true") return 1;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value; // Keep explicitly configured IP/CIDR lists supported by Express.
}
module.exports = { proxyTrust };
