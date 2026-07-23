"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { MarkdownDocument } from "./MarkdownDocument";

type ExpectedAction = {
  name: string;
  requestor: string;
  actionId: string;
  arguments: Record<string, unknown>;
};

type TestCase = {
  id: string;
  instructions: string;
  actions: ExpectedAction[];
  requiredDocuments: string[];
  topics: string[];
  rewardBasis: string[];
  communicateInfo: unknown[];
  userTools: string[];
};

type TestCaseBrowserProps = {
  query: string;
  onOpenDocument: (documentId: string) => void;
};

const TOPIC_LABELS: Record<string, string> = {
  "Bank accounts": "银行账户",
  "Checking accounts": "个人支票",
  "Savings accounts": "个人储蓄",
  "Credit cards": "个人信用卡",
  "Business checking": "企业支票",
  "Business savings": "企业储蓄",
  "Business credit cards": "企业信用卡",
  "Everyone Pay": "Everyone Pay",
  "Buy now, pay later": "先买后付",
  Subscriptions: "订阅服务",
  Support: "客户支持",
  Other: "其他",
};

function compactScenario(instructions: string) {
  const paragraphs = instructions
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const goal =
    paragraphs.find((paragraph) =>
      /looking|want|situation|issue|problem|trying|start by/i.test(paragraph),
    ) ?? paragraphs[1] ?? paragraphs[0] ?? "";
  return goal.slice(0, 190);
}

function prettyArguments(argumentsValue: Record<string, unknown>) {
  return JSON.stringify(argumentsValue, null, 2);
}

export function TestCaseBrowser({
  query,
  onOpenDocument,
}: TestCaseBrowserProps) {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [topic, setTopic] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/test-cases.json")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<TestCase[]>;
      })
      .then((loadedTestCases) => {
        setTestCases(loadedTestCases);
        setSelectedId(loadedTestCases[0]?.id ?? "");
      })
      .catch(() => setError("无法读取测试用例数据。"))
      .finally(() => setLoading(false));
  }, []);

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    testCases.forEach((testCase) => {
      testCase.topics.forEach((item) => {
        counts.set(item, (counts.get(item) ?? 0) + 1);
      });
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [testCases]);

  const filteredCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return testCases.filter((testCase) => {
      const matchesTopic =
        topic === "All" || testCase.topics.includes(topic);
      const searchable = [
        testCase.id,
        testCase.instructions,
        ...testCase.requiredDocuments,
        ...testCase.actions.map((action) => action.name),
      ]
        .join(" ")
        .toLowerCase();
      return matchesTopic && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [query, testCases, topic]);

  const selectedCase =
    filteredCases.find((testCase) => testCase.id === selectedId) ??
    filteredCases[0];
  const selectedIndex = selectedCase
    ? filteredCases.findIndex((testCase) => testCase.id === selectedCase.id)
    : -1;

  const moveSelection = (direction: -1 | 1) => {
    if (!filteredCases.length) return;
    const nextIndex = Math.min(
      filteredCases.length - 1,
      Math.max(0, selectedIndex + direction),
    );
    setSelectedId(filteredCases[nextIndex].id);
  };

  const handleListKeys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
    }
  };

  return (
    <section className="workspace test-workspace">
      <aside className="sidebar" aria-label="测试主题筛选">
        <div className="side-heading">
          <span>TEST TOPICS</span>
          <span>{topicCounts.length}</span>
        </div>
        <nav className="category-list">
          <button
            className={topic === "All" ? "active" : ""}
            onClick={() => setTopic("All")}
          >
            <span className="category-glyph all">T</span>
            <span>全部用例</span>
            <b>{testCases.length}</b>
          </button>
          {topicCounts.map(([topicName, count], index) => (
            <button
              key={topicName}
              className={topic === topicName ? "active" : ""}
              onClick={() => setTopic(topicName)}
            >
              <span className={`category-glyph hue-${index % 5}`}>
                {(TOPIC_LABELS[topicName] ?? topicName).slice(0, 1)}
              </span>
              <span>{TOPIC_LABELS[topicName] ?? topicName}</span>
              <b>{count}</b>
            </button>
          ))}
        </nav>
        <div className="test-help">
          <span>HOW TO READ</span>
          <p>
            用户场景是模型看到的输入；预期动作与参数决定该任务如何评分。
          </p>
        </div>
      </aside>

      <section className="document-index">
        <div className="index-heading">
          <div>
            <span>TEST CASES</span>
            <strong>{filteredCases.length} results</strong>
          </div>
          <p>↑↓ 浏览</p>
        </div>
        <div
          className="document-list test-list"
          tabIndex={0}
          onKeyDown={handleListKeys}
          aria-label="测试用例列表"
        >
          {loading && <div className="state-message">正在整理测试用例…</div>}
          {error && <div className="state-message error">{error}</div>}
          {!loading &&
            !error &&
            filteredCases.map((testCase) => (
              <button
                key={testCase.id}
                className={selectedCase?.id === testCase.id ? "selected" : ""}
                onClick={() => setSelectedId(testCase.id)}
              >
                <div className="result-topline">
                  <span>{testCase.id.toUpperCase()}</span>
                  <span className="tag test-tag">
                    {testCase.actions.length} ACTIONS
                  </span>
                </div>
                <h2>{compactScenario(testCase.instructions)}</h2>
                <div className="result-footer">
                  <span>
                    {testCase.topics
                      .map((item) => TOPIC_LABELS[item] ?? item)
                      .join(" · ")}
                  </span>
                  <span>{testCase.requiredDocuments.length} docs</span>
                </div>
              </button>
            ))}
          {!loading && !error && !filteredCases.length && (
            <div className="empty-state">
              <span>∅</span>
              <h2>没有匹配的测试用例</h2>
              <p>试试其他关键词或切换测试主题。</p>
            </div>
          )}
        </div>
      </section>

      <article className="reader test-reader">
        {selectedCase ? (
          <>
            <div className="reader-toolbar">
              <div className="breadcrumbs">
                <span>TEST SUITE</span>
                <i>/</i>
                <span>{selectedCase.id.toUpperCase()}</span>
              </div>
              <div className="reader-actions">
                <button
                  onClick={() => moveSelection(-1)}
                  disabled={selectedIndex <= 0}
                  aria-label="上一个测试用例"
                >
                  ←
                </button>
                <button
                  onClick={() => moveSelection(1)}
                  disabled={selectedIndex >= filteredCases.length - 1}
                  aria-label="下一个测试用例"
                >
                  →
                </button>
              </div>
            </div>
            <div className="reader-scroll">
              <div className="document-hero test-hero">
                <div className="eyebrow">
                  <span className="tag test-tag">TEST CASE</span>
                  <span>banking_knowledge</span>
                </div>
                <h1>{selectedCase.id.toUpperCase()}</h1>
                <div className="test-summary-grid">
                  <div>
                    <span>预期动作</span>
                    <strong>{selectedCase.actions.length}</strong>
                  </div>
                  <div>
                    <span>所需文档</span>
                    <strong>{selectedCase.requiredDocuments.length}</strong>
                  </div>
                  <div>
                    <span>评分依据</span>
                    <strong>{selectedCase.rewardBasis.join(" + ") || "—"}</strong>
                  </div>
                </div>
              </div>

              <div className="test-detail">
                <section className="scenario-section">
                  <div className="section-label">
                    <span>01</span>
                    <div>
                      <h2>用户场景</h2>
                      <p>这是 user simulator 用来生成对话的完整指令。</p>
                    </div>
                  </div>
                  <MarkdownDocument content={selectedCase.instructions} />
                </section>

                <section className="scenario-section">
                  <div className="section-label">
                    <span>02</span>
                    <div>
                      <h2>预期动作与参数</h2>
                      <p>运行结果会与这些标准动作进行匹配评分。</p>
                    </div>
                  </div>
                  <div className="action-stack">
                    {selectedCase.actions.map((action, index) => (
                      <details
                        className="action-card"
                        key={`${action.actionId}-${index}`}
                        open={index < 2}
                      >
                        <summary>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <code>{action.name}</code>
                          <b>{action.requestor || "agent"}</b>
                        </summary>
                        <pre>{prettyArguments(action.arguments)}</pre>
                      </details>
                    ))}
                  </div>
                </section>

                <section className="scenario-section">
                  <div className="section-label">
                    <span>03</span>
                    <div>
                      <h2>标准知识文档</h2>
                      <p>点击文档即可切换到知识库查看原文。</p>
                    </div>
                  </div>
                  <div className="required-documents">
                    {selectedCase.requiredDocuments.map((documentId) => (
                      <button
                        key={documentId}
                        onClick={() => onOpenDocument(documentId)}
                      >
                        <span>DOC</span>
                        <code>{documentId}</code>
                        <b>→</b>
                      </button>
                    ))}
                  </div>
                </section>

                {(selectedCase.userTools.length > 0 ||
                  selectedCase.communicateInfo.length > 0) && (
                  <section className="scenario-section compact-section">
                    <div className="section-label">
                      <span>04</span>
                      <div>
                        <h2>其他评估信息</h2>
                      </div>
                    </div>
                    {selectedCase.userTools.length > 0 && (
                      <div className="meta-row">
                        <span>User tools</span>
                        <code>{selectedCase.userTools.join(", ")}</code>
                      </div>
                    )}
                    {selectedCase.communicateInfo.length > 0 && (
                      <div className="meta-row">
                        <span>Communicate</span>
                        <code>
                          {JSON.stringify(selectedCase.communicateInfo)}
                        </code>
                      </div>
                    )}
                  </section>
                )}
              </div>
              <footer className="document-end">
                <span>END OF TEST CASE</span>
                <b>{selectedCase.id.replace("task_", "")}</b>
              </footer>
            </div>
          </>
        ) : (
          <div className="reader-placeholder">选择一个测试用例开始阅读</div>
        )}
      </article>
    </section>
  );
}
