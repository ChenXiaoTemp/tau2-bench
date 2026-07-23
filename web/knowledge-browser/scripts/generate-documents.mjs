import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const documentsDirectory = path.resolve(
  projectRoot,
  "../../data/tau2/domains/banking_knowledge/documents",
);
const tasksDirectory = path.resolve(
  projectRoot,
  "../../data/tau2/domains/banking_knowledge/tasks",
);
const documentsOutputFile = path.resolve(projectRoot, "public/documents.json");
const tasksOutputFile = path.resolve(projectRoot, "public/test-cases.json");
const runResultFile = process.env.TAU2_RUN_RESULTS_FILE
  ? path.resolve(process.env.TAU2_RUN_RESULTS_FILE)
  : path.resolve(
      projectRoot,
      "../../data/simulations/20260723_153013_banking_knowledge_llm_agent_doubao-seed-2-1-pro-260628_user_simulator_doubao-seed-2-1-pro-260628/results.json",
    );
const runResultsOutputFile = path.resolve(
  projectRoot,
  "public/run-results.json",
);

function compactMessageContent(message) {
  const content = String(message.content ?? "");
  const limit = message.role === "tool" ? 5000 : 20000;
  return {
    content: content.slice(0, limit),
    truncated: content.length > limit,
  };
}

function categoryFor(id) {
  if (id.startsWith("doc_bank_accounts_")) return "Bank accounts";
  if (id.startsWith("doc_checking_accounts_")) return "Checking accounts";
  if (id.startsWith("doc_savings_accounts_")) return "Savings accounts";
  if (id.startsWith("doc_credit_cards_")) return "Credit cards";
  if (id.startsWith("doc_business_checking_accounts_")) {
    return "Business checking";
  }
  if (id.startsWith("doc_business_savings_accounts_")) {
    return "Business savings";
  }
  if (id.startsWith("doc_business_credit_cards_")) {
    return "Business credit cards";
  }
  if (id.startsWith("doc_everyone_pay_")) return "Everyone Pay";
  if (id.startsWith("doc_buy_now_pay_later_")) return "Buy now, pay later";
  if (id.startsWith("doc_personal_subscriptions_")) return "Subscriptions";
  if (id.startsWith("doc_customer_support_")) return "Support";
  return "Other";
}

const files = (await readdir(documentsDirectory))
  .filter((file) => file.endsWith(".json"))
  .sort();

const documents = await Promise.all(
  files.map(async (file) => {
    const source = JSON.parse(
      await readFile(path.join(documentsDirectory, file), "utf8"),
    );
    const content = String(source.content ?? "").trim();
    return {
      id: String(source.id),
      title: String(source.title),
      content,
      category: categoryFor(String(source.id)),
      isInternal: String(source.title).startsWith("Internal:"),
      wordCount: content.split(/\s+/).filter(Boolean).length,
    };
  }),
);

documents.sort((a, b) => {
  const categoryOrder = a.category.localeCompare(b.category);
  return categoryOrder || a.title.localeCompare(b.title);
});

const taskFiles = (await readdir(tasksDirectory))
  .filter((file) => file.startsWith("task_") && file.endsWith(".json"))
  .sort();

const testCases = await Promise.all(
  taskFiles.map(async (file) => {
    const source = JSON.parse(
      await readFile(path.join(tasksDirectory, file), "utf8"),
    );
    const actions = source.evaluation_criteria?.actions ?? [];
    const requiredDocuments = source.required_documents ?? [];
    const topics = [
      ...new Set(
        requiredDocuments.map((documentId) => categoryFor(String(documentId))),
      ),
    ];

    return {
      id: String(source.id),
      instructions: String(source.user_scenario?.instructions ?? "").trim(),
      actions: actions.map((action) => ({
        name: String(action.name),
        requestor: String(action.requestor ?? ""),
        actionId: String(action.action_id ?? ""),
        arguments: action.arguments ?? {},
      })),
      requiredDocuments,
      topics: topics.length ? topics : ["Other"],
      rewardBasis: source.evaluation_criteria?.reward_basis ?? [],
      communicateInfo: source.evaluation_criteria?.communicate_info ?? [],
      userTools: source.user_tools ?? [],
    };
  }),
);

const runSourceText = await readFile(runResultFile, "utf8").catch((error) => {
  if (error.code === "ENOENT") return null;
  throw error;
});
let simulations;
let runResults;

if (runSourceText) {
const runSource = JSON.parse(runSourceText);
simulations = runSource.simulations
  .map((simulation) => {
    const rewardInfo = simulation.reward_info ?? {};
    return {
      taskId: String(simulation.task_id),
      reward: Number(rewardInfo.reward ?? 0),
      duration: Number(simulation.duration ?? 0),
      terminationReason: String(simulation.termination_reason ?? ""),
      agentCost: Number(simulation.agent_cost ?? 0),
      userCost: Number(simulation.user_cost ?? 0),
      dbMatch: Boolean(rewardInfo.db_check?.db_match),
      rewardBasis: rewardInfo.reward_basis ?? [],
      rewardBreakdown: rewardInfo.reward_breakdown ?? {},
      actionChecks: (rewardInfo.action_checks ?? []).map((check) => ({
        name: String(check.action?.name ?? ""),
        requestor: String(check.action?.requestor ?? ""),
        arguments: check.action?.arguments ?? {},
        matched: Boolean(check.action_match),
        reward: Number(check.action_reward ?? 0),
        toolType: String(check.tool_type ?? ""),
      })),
      messages: (simulation.messages ?? []).map((message) => ({
        role: String(message.role ?? ""),
        ...compactMessageContent(message),
        toolCalls: (message.tool_calls ?? []).map((toolCall) => ({
          name: String(toolCall.name ?? ""),
          requestor: String(toolCall.requestor ?? ""),
          arguments: toolCall.arguments ?? {},
        })),
      })),
    };
  })
  .sort((a, b) => a.taskId.localeCompare(b.taskId));

runResults = {
  timestamp: runSource.timestamp,
  sourceName: path.basename(path.dirname(runResultFile)),
  info: {
    domain: runSource.info?.environment_info?.domain_name,
    agentModel: runSource.info?.agent_info?.llm,
    userModel: runSource.info?.user_info?.llm,
    retrievalConfig: runSource.info?.retrieval_config,
    maxSteps: runSource.info?.max_steps,
    seed: runSource.info?.seed,
  },
  summary: {
    total: simulations.length,
    passed: simulations.filter((simulation) => simulation.reward === 1).length,
    failed: simulations.filter((simulation) => simulation.reward !== 1).length,
    averageReward:
      simulations.reduce((sum, simulation) => sum + simulation.reward, 0) /
      simulations.length,
    totalDuration: simulations.reduce(
      (sum, simulation) => sum + simulation.duration,
      0,
    ),
    totalMessages: simulations.reduce(
      (sum, simulation) => sum + simulation.messages.length,
      0,
    ),
    kbSearches: simulations.reduce(
      (sum, simulation) =>
        sum +
        simulation.messages.reduce(
          (messageSum, message) =>
            messageSum +
            message.toolCalls.filter((call) => call.name === "KB_search")
              .length,
          0,
        ),
      0,
    ),
  },
  simulations,
};
} else {
  runResults = JSON.parse(await readFile(runResultsOutputFile, "utf8"));
  simulations = runResults.simulations;
}

await mkdir(path.dirname(documentsOutputFile), { recursive: true });
await Promise.all([
  writeFile(documentsOutputFile, `${JSON.stringify(documents)}\n`),
  writeFile(tasksOutputFile, `${JSON.stringify(testCases)}\n`),
  writeFile(runResultsOutputFile, `${JSON.stringify(runResults)}\n`),
]);
console.log(
  `Generated ${documents.length} documents, ${testCases.length} test cases, and ${simulations.length} run results`,
);
