# 电商用户价值分层与营销策略分析

使用 1,000 名用户的消费、登录和浏览数据，完成用户分层、权重比较与营销收益测算，并制作 Power BI 和 HTML 两版看板。

**Python · SQL · Power BI · 数据可视化**

[分析报告](report/project_report.md) · [分析代码](code/) · [A/B 实验设计](report/ab_experiment_design.md)

## 看板展示

| Power BI 制作版 | HTML 交互版 · AI 协助制作 |
|---|---|
| ![Power BI 看板](dashboard/PowerBI预览.png) | ![HTML 看板](dashboard/HTML预览.png) |
| [下载 Power BI 文件](dashboard/电商用户分析_PowerBI.pbix?raw=true) | [下载 HTML 文件](dashboard/电商用户分析_HTML.html?raw=true) |
| 用 Power BI 展示用户分层、消费特征、权重和收益情景；图表可编辑，支持筛选联动。 | 在 AI 协助下制作交互页面，支持样本切换、散点框选、用户明细查询和收益参数调整。 |

Power BI 文件用 Power BI Desktop 打开；HTML 文件下载后用浏览器打开，可离线使用。GitHub 文件页本身不运行看板。两版均保留成品，开发过程文件留在本地。

## 分析过程

1. **检查数据**：核对用户粒度、缺失值和消费字段口径，标记需要进一步确认的记录。
2. **建立分层**：根据登录活跃、购买频次、累计消费和浏览表现计算得分，再按规则划分人群。
3. **比较结果**：检查排除待核对记录后的标签变化，以及浏览权重对前 200 名名单的影响。
4. **测算收益**：明确购买率、毛利率和成本假设，计算发券收益及盈亏平衡条件。
5. **设计验证**：编写邮件发券 A/B 实验方案，明确分组、指标、观察窗口和样本量。

## 主要发现

| 分析内容 | 结果 |
|---|---|
| 数据口径 | 85 人购买频次为 0，但累计消费大于 0。排除后重新计算，保留的 915 人中有 43 人标签变化。 |
| 用户分层 | 全量样本中，核心用户 70 人、潜力用户 89 人、其他用户 841 人。 |
| 浏览权重 | 固定选取 200 人，20% 浏览加权替换了 18 人；平均浏览分从 48.83 升至 53.07，平均累计消费从 4,117.73 降至 4,084.86。 |
| 收益条件 | 在自然购买率 1%、客单价 104.039、毛利率 40%、券额 10、联系成本 0.5 的假设下，活动购买率约需达到 2.90% 才收支平衡。 |

完整的分析方法、图表和解释见 [项目报告](report/project_report.md)，具体标签条件见 [分层规则](report/model_definition.md)。用户得分是筛选依据，不是购买概率；权重改变名单，也不代表营销效果一定改善。

## 文件说明

```text
├── README.md       项目介绍与两个看板预览
├── data/           原始数据、字段字典与数据许可
├── code/           四份 Notebook、必要 Python 代码和 SQL
├── report/         分析报告、分层规则与实验方案
├── outputs/        关键结果表与报告配图
├── dashboard/      两个看板成品及预览图
└── requirements.txt
```

四份 Notebook 按顺序为：数据检查、用户分层、SQL 与权重比较、收益情景测算。Python 公共函数集中在 `code/analysis.py`，不需要到其他工程目录寻找依赖。

## 运行代码

已保留执行后的 Notebook、结果表和看板，只查看作品不需要安装 Python。

重新计算分析结果时，在项目根目录运行：

```bash
python -m pip install -r requirements.txt
python code/analysis.py
```

需要逐步阅读或修改代码，运行 `jupyter lab`，依次打开 `code/` 中的四份 Notebook。收益参数直接写在第 4 份 Notebook 中。本项目在 Python 3.14.6 环境执行验证。

分析结果写入 `outputs/`。两个看板是本次分析的展示成品；修改数据、规则或参数后，需同步更新报告文字及看板，运行分析代码不会自动重做成品。

Power BI 的用户筛选基于全量样本已计算的标签，权重比较展示全样本前 200 名结果。HTML 额外支持切换为排除 85 人后重新计算的样本；两种操作的含义不同。

## 数据来源与说明

数据来自 `kartikeybartwal` 发布的 [Ecommerce Product Recommendation Collaborative](https://www.kaggle.com/datasets/kartikeybartwal/ecommerce-product-recommendation-collaborative)，包含 1,000 名用户、14 个业务字段，字段解释见 [数据字典](data/data_dictionary.csv)。数据集元数据于 2026-11-09 核对为 Apache 2.0 许可，许可全文保留在 [data/LICENSE.txt](data/LICENSE.txt)。原始 CSV 保持下载内容，读取时忽略导出行号列。

数据未明确币种和消费字段的统一统计周期，因此金额沿用原数据单位，85 条记录标为待核对而不直接判定错误。R 使用最近登录天数作为活跃度代理，并非最近购买时间。情景客单价取用户平均订单金额的简单均值，不等于从逐笔订单计算的整体客单价。

数据没有发券、实验分组和活动后购买记录。**收益是情景测算，A/B 实验是待执行方案**，本项目不声称已验证实际转化或利润提升。

HTML 使用 Apache ECharts 5.6.0，完整 LICENSE 和 NOTICE 已嵌入成品文件。第三方数据和组件保留各自许可。
