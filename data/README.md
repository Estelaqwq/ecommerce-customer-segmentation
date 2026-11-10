# 数据说明

## 来源

- 数据集：[Ecommerce Product Recommendation Collaborative](https://www.kaggle.com/datasets/kartikeybartwal/ecommerce-product-recommendation-collaborative)
- 发布者：`kartikeybartwal`
- 本地文件：`raw/user_personalized_features.csv`
- 许可：Kaggle 数据集元数据显示为 **Apache 2.0**，于 2026-11-09 核对。
- 来源及文件 SHA-256：[source_manifest.json](source_manifest.json)
- 许可文本：[APACHE-2.0.txt](../licenses/APACHE-2.0.txt)

原始 CSV 保留下载文件内容，读入时排除自动导出的行号列。分析结果另存于 `outputs/`，不覆盖原始数据。

## 粒度与口径

一行代表一名用户，共 1,000 行、14 个业务字段。没有逐笔交易、完整时间序列、实验分组或活动后结果。字段说明见 [data_dictionary.csv](data_dictionary.csv)。

需要保留的口径限制：

- `Last_Login_Days_Ago` 是最近登录距今的天数，并非最近一次购买距今的天数。
- `Purchase_Frequency` 和 `Total_Spending` 的统计周期是否相同未知，不假设二者能互相推导。
- `Average_Order_Value` 是用户级字段，项目采用其简单均值 104.039 作为情景客单价假设；这不等同于从订单明细计算的整体加权客单价。
- 币种、收入统计周期、采集方式与用户代表性未获确认。用户 ID 来自该公开表，不能作为可触达的真实账号。
- 邮件订阅字段用于假设的资格筛选，不代表已经具备真实营销授权、地址或送达能力。
- 兴趣与品类是不同分类体系，不直接把名称不相同解释成推荐不匹配。

## 待核对记录

85 人满足 `Purchase_Frequency == 0` 且 `Total_Spending > 0`。将其标为待核对，在全量分析中保留；另生成排除后重新计算的结果用于敏感性分析。排除不表示已证明记录错误。
