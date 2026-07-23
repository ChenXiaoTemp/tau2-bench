import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the knowledge library shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Rho Knowledge Library<\/title>/i);
  assert.match(html, /Knowledge Library/);
  assert.match(html, /测试用例/);
  assert.match(html, /运行结果/);
  assert.match(html, /搜索标题、正文或文档 ID/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("generates the complete local knowledge collection", async () => {
  const [documents, testCases, runResults] = await Promise.all([
    readFile(new URL("public/documents.json", projectRoot), "utf8").then(
      JSON.parse,
    ),
    readFile(new URL("public/test-cases.json", projectRoot), "utf8").then(
      JSON.parse,
    ),
    readFile(new URL("public/run-results.json", projectRoot), "utf8").then(
      JSON.parse,
    ),
  ]);

  assert.equal(documents.length, 698);
  assert.ok(documents.every((document) => document.id));
  assert.ok(documents.every((document) => document.title));
  assert.ok(documents.every((document) => document.content));
  assert.ok(documents.some((document) => document.isInternal));
  assert.ok(documents.some((document) => !document.isInternal));
  assert.equal(testCases.length, 97);
  assert.ok(testCases.every((testCase) => testCase.instructions));
  assert.ok(testCases.every((testCase) => testCase.requiredDocuments));
  assert.ok(testCases.some((testCase) => testCase.actions.length > 0));
  assert.equal(runResults.simulations.length, 5);
  assert.equal(runResults.summary.passed, 3);
  assert.equal(runResults.summary.failed, 2);
  assert.equal(runResults.summary.averageReward, 0.6);
});
