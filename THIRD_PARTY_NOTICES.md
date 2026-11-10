# 数据与第三方组件

## 数据集

本项目使用 `kartikeybartwal` 发布的 [Ecommerce Product Recommendation Collaborative](https://www.kaggle.com/datasets/kartikeybartwal/ecommerce-product-recommendation-collaborative)。Kaggle 数据集元数据在 2026-11-09 显示许可为 Apache 2.0。

原始 CSV 保持内容不变；清理、特征、分层和测算结果另行保存。来源记录见 [data/source_manifest.json](data/source_manifest.json)，许可全文见 [licenses/APACHE-2.0.txt](licenses/APACHE-2.0.txt)。

## 图表库

HTML 看板包含 Apache ECharts 5.6.0 的本地发行文件，项目地址为 [Apache ECharts](https://github.com/apache/echarts)。保留其 [LICENSE](dashboard/vendor/ECHARTS-LICENSE.txt) 与 [NOTICE](dashboard/vendor/ECHARTS-NOTICE.txt)，并在单文件看板中嵌入相同许可声明。

## 其他依赖

Python 依赖通过 `requirements.txt` 安装，不在仓库中分发其源码。各依赖保留各自许可。Power BI 项目文件需使用相应软件打开，不包含 Power BI 程序。

上述许可适用于对应数据或第三方组件，不自动等同于整个项目采用同一许可。
