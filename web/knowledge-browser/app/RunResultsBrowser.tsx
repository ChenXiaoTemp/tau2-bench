"use client";

import { useEffect, useMemo, useState } from "react";

type ToolCall = {
  name: string;
  requestor: string;
  arguments: Record<string, unknown>;
};

type RunMessage = {
  role: string;
  content: string;
  truncated: boolean;
  toolCalls: ToolCall[];
};

type ActionCheck = {
  name: string;
  requestor: string;
  arguments: Record<string, unknown>;
  matched: boolean;
  reward: number;
  toolType: string;
};

type Simulation = {
  taskId: string;
  reward: number;
  duration: number;
  terminationReason: string;
  dbMatch: boolean;
  rewardBasis: string[];
  rewardBreakdown: Record<string, number>;
  actionChecks: ActionCheck[];
  messages: RunMessage[];
};

type RunResults = {
  timestamp: string;
  sourceName: string;
  info: {
    domain: string;
    agentModel: string;
    userModel: string;
    retrievalConfig: string;
    maxSteps: number;
    seed: number;
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
    averageReward: number;
    totalDuration: number;
    totalMessages: number;
    kbSearches: number;
  };
  simulations: Simulation[];
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function roleLabel(role: string) {
  if (role === "assistant") return "AGENT";
  if (role === "user") return "USER";
  if (role === "tool") return "TOOL";
  return role.toUpperCase();
}

export function RunResultsBrowser({ query }: { query: string }) {
  const [data, setData] = useState<RunResults | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch("/run-results.json")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<RunResults>;
      })
      .then((loaded) => {
        setData(loaded);
        setSelectedId(loaded.simulations[0]?.taskId ?? "");
      })
      .catch(() => setLoadError("无法读取本次运行结果。"));
  }, []);

  const selected =
    data?.simulations.find((simulation) => simulation.taskId === selectedId) ??
    data?.simulations[0];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleMessages = useMemo(() => {
    if (!selected || !normalizedQuery) return selected?.messages ?? [];
    return selected.messages.filter(
      (message) =>
        message.role.toLowerCase().includes(normalizedQuery) ||
        message.content.toLowerCase().includes(normalizedQuery) ||
        message.toolCalls.some(
          (call) =>
            call.name.toLowerCase().includes(normalizedQuery) ||
            JSON.stringify(call.arguments)
              .toLowerCase()
              .includes(normalizedQuery),
        ),
    );
  }, [normalizedQuery, selected]);

  if (loadError) {
    return <div className="run-state error">{loadError}</div>;
  }
  if (!data || !selected) {
    return <div className="run-state">正在整理 5 个任务的运行轨迹…</div>;
  }

  return (
    <section className="results-view">
      <div className="run-overview">
        <div className="run-heading">
          <div>
            <span>RUN / 2026-07-23</span>
            <h2>Banking Knowledge Evaluation</h2>
          </div>
          <div className="run-config">
            <span>{data.info.retrievalConfig}</span>
            <code>{data.info.agentModel}</code>
          </div>
        </div>

        <div className="run-summary-grid">
          <div className="metric-card primary">
            <span>PASS RATE</span>
            <strong>
              {data.summary.passed}/{data.summary.total}
            </strong>
            <small>{Math.round(data.summary.averageReward * 100)}%</small>
          </div>
          <div className="metric-card">
            <span>AVG REWARD</span>
            <strong>{data.summary.averageReward.toFixed(2)}</strong>
            <small>binary task score</small>
          </div>
          <div className="metric-card">
            <span>TOTAL TIME</span>
            <strong>{formatDuration(data.summary.totalDuration)}</strong>
            <small>{data.summary.totalMessages} messages</small>
          </div>
          <div className="metric-card">
            <span>KB SEARCHES</span>
            <strong>{data.summary.kbSearches}</strong>
            <small>{data.info.retrievalConfig}</small>
          </div>
        </div>

        <div className="task-result-grid" aria-label="任务运行结果">
          {data.simulations.map((simulation, index) => {
            const passed = simulation.reward === 1;
            return (
              <button
                key={simulation.taskId}
                className={`${passed ? "passed" : "failed"} ${
                  selected.taskId === simulation.taskId ? "selected" : ""
                }`}
                onClick={() => setSelectedId(simulation.taskId)}
              >
                <span>0{index + 1}</span>
                <div>
                  <code>{simulation.taskId}</code>
                  <strong>{passed ? "PASS" : "FAIL"}</strong>
                </div>
                <small>{formatDuration(simulation.duration)}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="result-detail-grid">
        <aside className="evaluation-panel">
          <div className="detail-title">
            <span>EVALUATION</span>
            <h2>{selected.taskId}</h2>
            <div
              className={`outcome-badge ${
                selected.reward === 1 ? "passed" : "failed"
              }`}
            >
              {selected.reward === 1 ? "✓ PASS" : "× FAIL"}
            </div>
          </div>

          <dl className="result-facts">
            <div>
              <dt>Reward</dt>
              <dd>{selected.reward.toFixed(1)}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{formatDuration(selected.duration)}</dd>
            </div>
            <div>
              <dt>Termination</dt>
              <dd>{selected.terminationReason}</dd>
            </div>
            <div>
              <dt>Messages</dt>
              <dd>{selected.messages.length}</dd>
            </div>
          </dl>

          <div className="checks-heading">
            <span>ACTION CHECKS</span>
            <b>{selected.actionChecks.length}</b>
          </div>
          <div className="check-list">
            {selected.actionChecks.length ? (
              selected.actionChecks.map((check, index) => (
                <details className="check-card" key={`${check.name}-${index}`}>
                  <summary>
                    <span className={check.matched ? "matched" : "missed"}>
                      {check.matched ? "✓" : "×"}
                    </span>
                    <code>{check.name}</code>
                    <b>{check.matched ? "MATCH" : "MISS"}</b>
                  </summary>
                  <pre>{JSON.stringify(check.arguments, null, 2)}</pre>
                </details>
              ))
            ) : (
              <p className="no-checks">本任务没有 action check，依据 DB 评分。</p>
            )}
          </div>

          <div className="run-metadata">
            <span>RUN METADATA</span>
            <code>seed {data.info.seed}</code>
            <code>max steps {data.info.maxSteps}</code>
            <code>{data.sourceName}</code>
          </div>
        </aside>

        <section className="transcript-panel">
          <div className="transcript-heading">
            <div>
              <span>CONVERSATION TRACE</span>
              <h2>完整对话与工具调用</h2>
            </div>
            <p>
              {normalizedQuery
                ? `${visibleMessages.length} 条匹配`
                : `${selected.messages.length} 条消息`}
            </p>
          </div>

          <div className="message-timeline">
            {visibleMessages.map((message, index) => (
              <article
                className={`trace-message role-${message.role}`}
                key={`${message.role}-${index}`}
              >
                <div className="trace-rail">
                  <span>{roleLabel(message.role).slice(0, 1)}</span>
                  <i />
                </div>
                <div className="trace-content">
                  <div className="trace-meta">
                    <b>{roleLabel(message.role)}</b>
                    <span>#{String(index + 1).padStart(3, "0")}</span>
                  </div>
                  {message.content &&
                    (message.role === "tool" ? (
                      <details className="tool-response">
                        <summary>
                          查看检索返回内容
                          {message.truncated ? "（已截取前 5,000 字符）" : ""}
                        </summary>
                        <pre>{message.content}</pre>
                      </details>
                    ) : (
                      <p>{message.content}</p>
                    ))}
                  {message.toolCalls.map((call, callIndex) => (
                    <div
                      className="tool-call"
                      key={`${call.name}-${callIndex}`}
                    >
                      <div>
                        <span>TOOL CALL</span>
                        <code>{call.name}</code>
                      </div>
                      <pre>{JSON.stringify(call.arguments, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {!visibleMessages.length && (
              <div className="no-trace">当前任务的轨迹中没有匹配内容。</div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
