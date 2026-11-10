"""用户分层、敏感性分析与营销情景计算。所有金额沿用数据原单位。"""
from pathlib import Path
import math
import sqlite3
from statistics import NormalDist

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CORE = ('核心VIP', '重要价值用户')
POTENTIAL = ('高收入高浏览低购买用户', '高潜沉睡用户', '犹豫型潜力用户', '高收入消费较高低活跃用户')
TARGET = CORE + POTENTIAL


def save_csv(frame, path, index=False):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=index, encoding='utf-8-sig')


def load_data(path=None):
    """读取一人一行的原始表；导出行号不计为业务字段。"""
    frame = pd.read_csv(path or ROOT / 'data/user_personalized_features.csv')
    frame = frame.loc[:, ~frame.columns.str.startswith('Unnamed:')].copy()
    if frame['User_ID'].duplicated().any():
        raise ValueError('用户 ID 不唯一，请先核对数据粒度。')
    return frame


def audit_data(raw):
    """区分可直接检查的问题和需要业务确认的统计口径。"""
    flag = (raw.Purchase_Frequency == 0) & (raw.Total_Spending > 0)
    audit = pd.DataFrame([
        ['用户数', len(raw)], ['业务字段数', raw.shape[1]],
        ['重复用户ID数', int(raw.User_ID.duplicated().sum())],
        ['缺失单元格数', int(raw.isna().sum().sum())],
        ['待核对用户数', int(flag.sum())],
        ['最近登录天数最小值', raw.Last_Login_Days_Ago.min()],
        ['最近登录天数最大值', raw.Last_Login_Days_Ago.max()],
        ['邮件订阅人数', int(raw.Newsletter_Subscription.sum())],
    ], columns=['检查项', '结果'])
    save_csv(audit, ROOT / 'outputs/data_audit.csv')
    return audit


def scale_100(values, reverse=False):
    """极差归一化；常数列取 50，且保留用户索引。"""
    lower, upper = values.min(), values.max()
    if upper == lower:
        return pd.Series(50.0, index=values.index)
    scaled = (values - lower) / (upper - lower) * 100
    return 100 - scaled if reverse else scaled


def score_users(raw, weight=.2):
    """计算特征，不把浏览得分解释为购买概率。"""
    if not 0 <= weight <= 1:
        raise ValueError('浏览加权幅度需在 0～1 之间。')
    users = raw.copy()
    users['Needs_Review'] = (users.Purchase_Frequency == 0) & (users.Total_Spending > 0)
    users['Time_Spent_Norm'] = scale_100(users.Time_Spent_on_Site_Minutes)
    users['Pages_Viewed_Norm'] = scale_100(users.Pages_Viewed)
    users['I_Score'] = users[['Time_Spent_Norm', 'Pages_Viewed_Norm']].mean(axis=1)
    users['Friction'] = users.Pages_Viewed / (users.Purchase_Frequency + 1)
    users['L_Score'] = np.select([
        users.Newsletter_Subscription & (users.Last_Login_Days_Ago < 7),
        ~users.Newsletter_Subscription & (users.Last_Login_Days_Ago < 7),
    ], [3, 2], default=1)
    q33, q66 = users.Income.quantile([.33, .66])
    users['Income_Level'] = np.select([users.Income <= q33, users.Income <= q66], ['Low', 'Medium'], default='High')
    users['R_Score'] = scale_100(users.Last_Login_Days_Ago, reverse=True)
    users['F_Score'] = scale_100(users.Purchase_Frequency)
    users['M_Score'] = scale_100(users.Total_Spending)
    users['RFM_Score'] = .2 * users.R_Score + .3 * users.F_Score + .5 * users.M_Score
    users['I_Weight'] = weight * users.I_Score / 100
    users['Final_Score'] = users.RFM_Score * (1 + users.I_Weight)
    return users


def segment_users(scored):
    """按有顺序的规则分层。标签规则与综合得分排序是两套不同逻辑。"""
    users = scored.copy()
    r, f, m, i = (users[c] for c in ['R_Score', 'F_Score', 'M_Score', 'I_Score'])
    high, low = users.Income_Level.eq('High'), users.Income_Level.eq('Low')
    base = pd.Series(np.select([
        (r > 60) & (f > 60) & (m > 60),
        (r > 60) & (m > 60) & (f < 40),
        (r < 40) & (f > 60) & (m > 60),
        (r < 40) & (m > 60),
        (r > 60) & (f > 40) & (m < 40),
        (r > 60) & (f < 40) & (m < 40),
        (r < 40) & (f < 40) & (m < 40),
    ], ['重要价值用户', '重要发展用户', '重要保持用户', '重要挽留用户',
        '一般发展用户', '一般维持用户', '低价值用户'], default='一般用户'), index=users.index)
    # np.select 取第一个满足的条件；优先级属于模型定义的一部分。
    labels = np.select([
        base.isin(['低价值用户', '一般维持用户']) & high & (i > 60),
        high & (i > 70) & (f < 40) & (m < 50),
        base.isin(['一般维持用户', '一般发展用户']) & (i > 80) & (users.Friction > users.Friction.quantile(.6)),
        low & (i > 70) & (f < 40),
        high & (r < 40) & (m > 50),
        (m > 70) & (f > 70) & (i > 60),
        low & (i < 40) & (m < 40),
    ], ['高潜沉睡用户', '高收入高浏览低购买用户', '犹豫型潜力用户', '隐形活跃者',
        '高收入消费较高低活跃用户', '核心VIP', '低收入低浏览低消费用户'], default=base)
    users['User_Segment'] = labels
    users['Segment_Name'] = labels
    users['Group_Type'] = np.select([users.User_Segment.isin(CORE), users.User_Segment.isin(POTENTIAL)], ['核心', '潜力'], default='其他')
    return users


def summarize_segments(users):
    result = users.groupby('Segment_Name').agg(
        用户数=('User_ID', 'size'), 平均累计消费=('Total_Spending', 'mean'),
        平均购买频次=('Purchase_Frequency', 'mean'), 平均浏览得分=('I_Score', 'mean'),
        平均收入=('Income', 'mean'), 平均综合分=('Final_Score', 'mean'),
    ).round(2)
    result['占比(%)'] = (result['用户数'] / len(users) * 100).round(1)
    return result.sort_values('用户数', ascending=False)


def run_segmentation(raw=None):
    raw = load_data() if raw is None else raw
    full = segment_users(score_users(raw))
    # 从原始字段重新做特征、分位数、分层，不能仅删除已评分表中的 85 行。
    kept_raw = raw.loc[~full.Needs_Review].copy()
    recomputed = segment_users(score_users(kept_raw))
    save_csv(full, ROOT/'outputs/user_segments.csv')
    save_csv(recomputed, ROOT/'outputs/user_segments_recomputed.csv')
    retained = full.loc[~full.Needs_Review]
    matched = retained[['User_ID', 'User_Segment', 'Final_Score']].merge(
        recomputed[['User_ID', 'User_Segment', 'Final_Score']], on='User_ID', suffixes=('_before', '_after'), validate='one_to_one')
    matched['label_changed'] = matched.User_Segment_before != matched.User_Segment_after
    save_csv(matched.loc[matched.label_changed], ROOT/'outputs/label_changes.csv')
    overview = pd.DataFrame([{
        '样本': name, '用户数': len(users), '待核对人数': int(users.Needs_Review.sum()),
        '平均累计消费': users.Total_Spending.mean(), '平均浏览得分': users.I_Score.mean(),
    } for name,users in [('全量样本',full),('剔除后重算',recomputed)]]).round(2)
    save_csv(overview, ROOT/'outputs/quality_comparison.csv')
    old_ids = set(full.loc[full.User_Segment.isin(TARGET), 'User_ID'])
    flagged_ids = set(full.loc[full.Needs_Review, 'User_ID'])
    retained_ids = old_ids - flagged_ids
    new_ids = set(recomputed.loc[recomputed.User_Segment.isin(TARGET), 'User_ID'])
    target_changes = pd.DataFrame([
        ['全量目标人数',len(old_ids)], ['原目标中被标记排除',len(old_ids & flagged_ids)],
        ['保留用户按原评分入选',len(retained_ids)], ['保留用户重算后入选',len(new_ids)],
        ['重新评分后离开',len(retained_ids-new_ids)], ['重新评分后新进入',len(new_ids-retained_ids)],
    ], columns=['指标','人数'])
    return full, recomputed, matched, target_changes


def compare_weights(users, weights=(0,.1,.2,.3), top_n=200):
    count = min(top_n, len(users))
    base = users.sort_values(['RFM_Score','User_ID'], ascending=[False,True]).head(count)
    base_ids = set(base.User_ID)
    rows = []
    for weight in weights:
        candidate = users.assign(Trial_Score=users.RFM_Score*(1+weight*users.I_Score/100))
        selected = candidate.sort_values(['Trial_Score','User_ID'], ascending=[False,True]).head(count)
        selected_ids = set(selected.User_ID)
        rows.append({'浏览加权幅度':weight,'人数':count,'与基础名单重合比例':len(base_ids & selected_ids)/count if count else np.nan,
                     '替换人数':len(selected_ids-base_ids),'平均累计消费':selected.Total_Spending.mean(),'平均浏览得分':selected.I_Score.mean()})
    result = pd.DataFrame(rows)
    save_csv(result,ROOT/'outputs/weight_comparison.csv')
    return result


def estimate_profit(n,p0,p1,aov,margin,coupon,contact):
    """每名购买用户一次订单、一次核销；券成本包括原本就会购买的用户。"""
    if n < 0 or n != int(n) or not all(0 <= p <= 1 for p in [p0,p1,margin]) or min(aov,coupon,contact)<0:
        raise ValueError('请检查人数、概率、毛利率和成本参数。')
    sales = n*(p1-p0)*aov
    gross = sales*margin
    coupon_cost, contact_cost = n*p1*coupon, n*contact
    cost = coupon_cost+contact_cost
    net = gross-cost
    return {'目标人数':n,'自然购买率':p0,'活动后购买率':p1,'假设客单价':aov,'假设毛利率':margin,
            '每次核销优惠额':coupon,'每人联系成本':contact,'预计新增购买人数':n*(p1-p0),
            '预计增量销售额':sales,'预计增量毛利':gross,'预计优惠成本':coupon_cost,
            '预计联系成本':contact_cost,'预计营销成本':cost,'预计增量净收益':net,'ROI':net/cost if cost else np.nan}


def run_scenarios(users, params=None):
    n = int(users.User_Segment.isin(POTENTIAL).sum())
    aov = float(users.Average_Order_Value.mean())
    # 参数是明确的业务假设，可以在 Notebook 中传入自己的设置。
    params = params or {'baseline_rate':.01, 'activity_rates':[.02,.05,.20],
                        'margin':.4, 'coupon':10, 'contact':.5}
    rows = []
    for name,p1 in zip(['较低提升','中等提升','较高提升'],params['activity_rates']):
        row = estimate_profit(n,params['baseline_rate'],p1,aov,params['margin'],params['coupon'],params['contact'])
        row['情景'] = name
        rows.append(row)
    result = pd.DataFrame(rows)
    save_csv(result,ROOT/'outputs/scenario_results.csv')
    sensitivity = pd.DataFrame([estimate_profit(n,.01,.05,aov,margin,coupon,.5) for margin in [.2,.4,.6] for coupon in [5,10,15]])
    response = pd.DataFrame([['核心',.25,.30],['潜力',.01,.20],['其他',.20,.30]],columns=['响应类型','自然购买率','活动后购买率'])
    parameters = response.set_index('响应类型')
    strategies = {'方案A_基础分前20%':users.sort_values(['RFM_Score','User_ID'],ascending=[False,True]).head(int(len(users)*.2)),
                  '方案B_核心与潜力':users.loc[users.User_Segment.isin(TARGET)]}
    details=[]
    for name, selected in strategies.items():
        for group, cohort in selected.groupby('Group_Type'):
            rate = parameters.loc[group]
            row = estimate_profit(len(cohort),rate['自然购买率'],rate['活动后购买率'],aov,params['margin'],params['coupon'],params['contact'])
            row.update({'策略':name,'响应类型':group})
            details.append(row)
    details = pd.DataFrame(details)
    total_cols=['目标人数','预计增量销售额','预计增量毛利','预计优惠成本','预计联系成本','预计营销成本','预计增量净收益']
    strategy_result=details.groupby('策略')[total_cols].sum()
    strategy_result['ROI']=strategy_result['预计增量净收益']/strategy_result['预计营销成本'].where(strategy_result['预计营销成本']>0)
    save_csv(strategy_result,ROOT/'outputs/strategy_comparison.csv',index=True)
    return result,sensitivity,strategy_result


def run_sql(full,recomputed):
    import re
    statements=re.split(r'^-- name: (.+)$',(ROOT/'code/analysis.sql').read_text(encoding='utf-8'),flags=re.M)
    results={}
    with sqlite3.connect(':memory:') as connection:
        full.to_sql('users',connection,index=False)
        recomputed.to_sql('users_recomputed',connection,index=False)
        for i in range(1,len(statements),2):
            name,sql=statements[i],statements[i+1].strip()
            result=pd.read_sql_query(sql,connection)
            if name == 'eligible_experiment_users':
                save_csv(result,ROOT/'outputs/eligible_experiment_users.csv')
            results[name]=result
    return results


def experiment_sample_size(p0=.01,p1=.02,alpha=.05,power=.8):
    if not(0<p0<1 and 0<p1<1 and p0!=p1 and 0<alpha<1 and 0<power<1):
        raise ValueError('请使用有效概率和非零差异。')
    z=NormalDist()
    average=(p0+p1)/2
    return math.ceil(2*average*(1-average)*(z.inv_cdf(1-alpha/2)+z.inv_cdf(power))**2/(p1-p0)**2)


if __name__ == '__main__':
    raw = load_data()
    audit_data(raw)
    full, clean, changes, targets = run_segmentation(raw)
    compare_weights(full)
    run_scenarios(full)
    run_sql(full, clean)
    from figures import generate_figures
    generate_figures()
    print('分析完成：结果位于 outputs/。看板是随附成品，修改分析后需另行更新看板。')
