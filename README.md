# 电商用户价值分层与营销策略分析

使用 1,000 名用户的消费、登录和浏览数据，分析用户特征、建立分层规则，并比较浏览加权和发券收益情景。

[项目报告](report/项目报告.md) · [用户分层代码](code/用户分层分析.ipynb) · [实验设计](report/实验设计.md)

## 看板

| Power BI 制作版 | HTML 交互版 · AI 协助制作 |
|---|---|
| ![Power BI 看板](dashboard/PowerBI预览.png) | ![HTML 看板](dashboard/HTML预览.png) |
| [下载 Power BI 文件](dashboard/电商用户分析_PowerBI.pbix?raw=true) | [下载 HTML 文件](dashboard/电商用户分析_HTML.html?raw=true) |

Power BI 文件用 Power BI Desktop 打开；HTML 下载后用浏览器打开，可离线使用。

## 主要结果

- 85 人购买频次为 0，但累计消费大于 0，需要核对统计周期。排除后重新计算，保留的 915 人中有 43 人标签变化。
- 全量样本中，核心用户 70 人、潜力用户 89 人、其他用户 841 人。
- 固定选前 200 人，浏览加权幅度设为 20% 时替换 18 人，平均浏览得分提高，平均累计消费略降。
- 在自然购买率 1%、客单价 104.039、毛利率 40%、券额 10、联系成本 0.5 的假设下，活动购买率约需达到 2.90% 才能收支平衡。

## 代码

三份 Notebook 放在 `code/`，计算和绘图代码都在文件内。

| 文件 | 内容 |
|---|---|
| [SQL与权重分析.ipynb](code/SQL与权重分析.ipynb) | SQL 汇总、前 200 名查询、浏览权重比较及绘图 |
| [用户分层分析.ipynb](code/用户分层分析.ipynb) | 数据检查、探索分析、评分、分层，以及排除 85 人后的重算比较 |
| [收益情景测算.ipynb](code/收益情景测算.ipynb) | 三档收益假设、盈亏平衡、券额与毛利率比较、两种人群策略测算 |

`用户分层分析.ipynb` 中第 9 步保留早期 ROI 演示；报告中的收益结论采用 `收益情景测算.ipynb` 的毛利、核销优惠和联系成本口径。

## 运行

在本目录安装依赖并启动 Jupyter：

```bash
python -m pip install -r requirements.txt
jupyter lab
```

从项目目录启动 Jupyter，打开 `code/` 中的 Notebook，各文件内部从上到下运行。先运行 `用户分层分析.ipynb`，再运行 `收益情景测算.ipynb`。`SQL与权重分析.ipynb` 读取的 `outputs/baseline/user_segments.csv` 已附在包中。也可以直接查看保留的运行结果。

`data/` 放原始数据与字段说明，`outputs/` 保留主要结果表和原配图，`report/` 放报告与实验方案，`dashboard/` 放两个看板成品及预览图。运行 Notebook 会在原有目录生成其他汇总表和配图。

## 数据与方法说明

数据来自 [Ecommerce Product Recommendation Collaborative](https://www.kaggle.com/datasets/kartikeybartwal/ecommerce-product-recommendation-collaborative)，14 个业务字段，解释见 [数据字典](data/data_dictionary.xlsx)，许可见 [data/LICENSE.txt](data/LICENSE.txt)。原始 CSV 的导出行号不算业务字段。

方法参考小马上学数分的视频及配套代码，补充字段口径核查、重算比较、浏览权重比较和透明收益测算。代码中的标签名称保留，报告和看板使用对应的展示名称。

最近登录代表活跃度，金额单位与消费统计周期未确认。用户得分用于排序，收益为假设情景；现有数据没有活动后的真实购买结果，A/B 部分为待执行方案。

看板为随附成品，修改分析数据后需另行更新。HTML 内保留 Apache ECharts 的 LICENSE 和 NOTICE。
