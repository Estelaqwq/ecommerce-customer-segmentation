"""从项目根目录运行：python run_analysis.py。"""
import runpy
from src.analysis import ROOT, load_data, audit_data, run_segmentation, compare_weights, run_scenarios, run_sql
from src.figures import generate_figures

if __name__ == '__main__':
    print('1/6 检查原始数据')
    raw = load_data();audit_data(raw)
    print('2/6 全量分层与剔除后重算')
    full, clean, changes, targets = run_segmentation(raw)
    print('3/6 SQL 与浏览权重比较')
    run_sql(full,clean);compare_weights(full)
    print('4/6 收益情景测算')
    run_scenarios(full)
    print('5/6 生成报告图表')
    generate_figures()
    print('6/6 更新离线 HTML 看板')
    runpy.run_path(str(ROOT/'dashboard/build.py'),run_name='__main__')
    print('完成。打开 dashboard/index.html 查看结果。')
