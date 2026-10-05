"use strict";

// A destructive restore exercise, restricted to this project's disposable local container.
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const prefix = `vvv_restore_${crypto.randomBytes(6).toString("hex")}`;
const source = `${prefix}_source_test`, target = `${prefix}_target_test`;
const archive = `/tmp/${prefix}.archive.gz`;
function docker(...args) {
  return execFileSync("docker", ["compose", "-p", "vuavuive-qa", "-f", "ops/compose.qa.yml", "exec", "-T", "mongo", ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function mongo(code) { return docker("mongosh", "--quiet", "--eval", code); }
if (![source, target].every((name) => /^vvv_restore_[a-f0-9]+_(source|target)_test$/.test(name))) throw new Error("Unsafe database name");
try {
  mongo(`const s=db.getSiblingDB('${source}'); s.orders.createIndex({fixtureId:1},{unique:true}); s.orders.insertMany([{fixtureId:1,total:65000},{fixtureId:2,total:120000}]);`);
  docker("mongodump", "--db", source, `--archive=${archive}`, "--gzip");
  docker("mongorestore", `--archive=${archive}`, "--gzip", `--nsFrom=${source}.*`, `--nsTo=${target}.*`);
  const result = JSON.parse(mongo(`const s=db.getSiblingDB('${source}'),t=db.getSiblingDB('${target}'); print(JSON.stringify({source:s.orders.countDocuments(),restored:t.orders.countDocuments(),total:t.orders.aggregate([{$group:{_id:null,total:{$sum:'$total'}}}]).toArray()[0].total,uniqueIndex:t.orders.getIndexes().some(x=>x.name==='fixtureId_1'&&x.unique)}));`));
  if (result.source !== 2 || result.restored !== 2 || result.total !== 185000 || !result.uniqueIndex) throw new Error("Restore verification failed");
  console.log(JSON.stringify({ status: "Passed", environment: "local synthetic MongoDB replica set", ...result }));
} catch (error) {
  console.error("Restore drill failed; no production database was accessed.");
  process.exitCode = 1;
} finally {
  mongo(`db.getSiblingDB('${source}').dropDatabase(); db.getSiblingDB('${target}').dropDatabase();`);
  docker("rm", "-f", archive);
}
