# τ-bench Knowledge Browser

本地浏览和搜索 `banking_knowledge` 的 698 篇知识库文档。

```bash
cd web/knowledge-browser
npm install
npm run dev
```

打开终端输出的 Local URL。页面支持：

- 标题、正文和文档 ID 全文搜索
- 产品分类与内部/客户文档筛选
- Markdown 阅读视图
- 浏览 97 个测试用例的用户场景、预期动作和评分依据
- 查看刚才运行的 5 个任务的通过率、耗时、评分检查和完整对话轨迹
- 从测试用例直接跳转到对应的标准知识文档
- 键盘 `↑` / `↓` 切换文档，`/` 聚焦搜索
- 一键复制当前文档

`npm run dev` 和 `npm run build` 会自动从
`data/tau2/domains/banking_knowledge/documents/` 重新生成
`public/documents.json`、`public/test-cases.json` 和
`public/run-results.json`。

若要用新的评测结果替换页面中的运行快照，可指定原始结果文件：

```bash
TAU2_RUN_RESULTS_FILE=/path/to/results.json npm run generate:documents
```

未找到本地原始结果时，会保留仓库内已提交的运行结果快照。
