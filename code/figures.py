"""从导出的结果生成报告配图，保持图表与分析使用同一份数据。"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.ticker import PercentFormatter
import numpy as np
import pandas as pd
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

BLUE, LIGHT, INK, RED = '#225AA7', '#76A7D3', '#233E62', '#B66E75'
OUT = ROOT/'outputs/figures'


def generate_figures():
    OUT.mkdir(parents=True,exist_ok=True)
    installed={f.name for f in font_manager.fontManager.ttflist}
    chosen=next((f for f in ['Microsoft YaHei','SimHei','Noto Sans CJK SC','WenQuanYi Micro Hei'] if f in installed),None)
    chinese=chosen is not None
    plt.rcParams.update({'font.family':chosen or 'DejaVu Sans','axes.unicode_minus':False,
                         'font.size':10,'axes.spines.top':False,'axes.spines.right':False,
                         'axes.labelcolor':INK,'text.color':INK,'xtick.color':INK,'ytick.color':INK})
    label=lambda zh,en:zh if chinese else en
    full=pd.read_csv(ROOT/'outputs/user_segments.csv')
    clean=pd.read_csv(ROOT/'outputs/user_segments_recomputed.csv')
    weights=pd.read_csv(ROOT/'outputs/weight_comparison.csv')
    changes=pd.read_csv(ROOT/'outputs/label_changes.csv')
    scenarios=pd.read_csv(ROOT/'outputs/scenario_results.csv')
    def finish(fig,name):
        fig.tight_layout(pad=1.8)
        fig.savefig(OUT/name,dpi=160,facecolor='white',bbox_inches='tight')
        plt.close(fig)
    def clean_axes(ax):
        ax.set_axisbelow(True);ax.grid(axis='y',color='#e7edf5',linewidth=.7)
    fig,axes=plt.subplots(1,2,figsize=(11.5,4.2))
    selected=full.Group_Type.isin(['核心','潜力'])
    values=[int(selected.sum()),int((selected & ~full.Needs_Review).sum()),int(clean.Group_Type.isin(['核心','潜力']).sum())]
    bars=axes[0].bar(range(3),values,color=[LIGHT,'#B9CDE4',BLUE],width=.55)
    axes[0].set_xticks(range(3),[label('全量目标','Original target'),label('移除标记记录','Retained target'),label('重新评分后','Recomputed target')])
    axes[0].set_ylim(0,max(values)*1.18);axes[0].set_title(label('目标名单：','Target audience: ')+' → '.join(map(str,values)),loc='left',fontweight='bold')
    axes[0].bar_label(bars,padding=5)
    bars=axes[1].bar([0,1],[len(clean)-len(changes),len(changes)],color=[LIGHT,BLUE],width=.5)
    axes[1].set_xticks([0,1],[label('标签保持不变','Unchanged label'),label('标签发生变化','Changed label')])
    axes[1].set_ylim(0,1000);axes[1].bar_label(bars,padding=5)
    axes[1].set_title(label(f'同一批 {len(clean)} 人中，{len(changes)} 人标签变化',f'{len(changes)} of the same {len(clean)} users changed label'),loc='left',fontweight='bold')
    for ax in axes:clean_axes(ax)
    finish(fig,'quality_sensitivity.png')
    fig,axes=plt.subplots(1,3,figsize=(13,3.8))
    x=weights['浏览加权幅度']*100
    for ax,col,title in zip(axes,['与基础名单重合比例','平均累计消费','平均浏览得分'],
                           [label('与基础名单的重合率','Overlap with baseline'),label('入选用户平均累计消费','Mean historical spend'),label('入选用户平均浏览得分','Mean browsing score')]):
        y=weights[col]
        ax.plot(x,y,marker='o',color=BLUE,lw=2);ax.set_title(title,loc='left',fontweight='bold')
        ax.set_xticks(x,[f'{v:.0f}%' for v in x]);ax.set_xlabel(label('浏览最高加分幅度','Browsing multiplier'))
        if col=='与基础名单重合比例':ax.set_ylim(0,1.08);ax.yaxis.set_major_formatter(PercentFormatter(1));formatted=[f'{v:.1%}' for v in y]
        elif col=='平均浏览得分':ax.set_ylim(0,100);formatted=[f'{v:.2f}' for v in y]
        else:ax.set_ylim(0,4600);formatted=[f'{v:,.2f}' for v in y]
        for xi,yi,s in zip(x,y,formatted):ax.annotate(s,(xi,yi),xytext=(0,8),textcoords='offset points',ha='center',fontsize=9)
        clean_axes(ax)
    finish(fig,'weight_sensitivity.png')
    fig,ax=plt.subplots(figsize=(8.5,4.5))
    net=scenarios['预计增量净收益']
    bars=ax.bar(range(3),net,color=[RED if v<0 else BLUE for v in net],width=.52)
    ax.axhline(0,color='#859AB6',lw=.8);ax.bar_label(bars,fmt='%.2f',padding=5)
    ax.set_xticks(range(3),[label('发券后 ','Treatment ')+f'{rate:.0%}' for rate in scenarios['活动后购买率']])
    ax.set_ylim(-100,550);ax.set_ylabel(label('预计增量净收益（假设金额单位）','Incremental net profit (assumed unit)'))
    target_n=int(scenarios.iloc[0]['目标人数'])
    ax.set_title(label(f'同一批 {target_n} 人，不同购买率假设',f'Same {target_n} users, different conversion assumptions'),loc='left',fontweight='bold')
    clean_axes(ax);finish(fig,'scenario_profit.png')
    profile=full.groupby('Group_Type')[['R_Score','F_Score','M_Score','I_Score']].mean().reindex(['核心','潜力','其他'])
    fig,ax=plt.subplots(figsize=(9,4.5));x=np.arange(3)
    for index,(col,name,c) in enumerate(zip(profile.columns,[label('登录活跃','Login activity'),label('购买频次','Frequency'),label('累计消费','Spending'),label('浏览行为','Browsing')],[BLUE,LIGHT,'#A4C7E6','#6D83A8'])):
        ax.bar(x+(index-1.5)*.18,profile[col],width=.16,label=name,color=c)
    ax.set_xticks(x,[label('核心用户','Core'),label('潜力用户','Potential'),label('其他用户','Other')]);ax.set_ylim(0,100)
    ax.set_title(label('三类人群的平均特征得分','Average feature scores by group'),loc='left',fontweight='bold')
    ax.set_ylabel(label('标准化得分','Normalized score'));ax.legend(frameon=False,ncol=4,loc='upper right',fontsize=9)
    clean_axes(ax);finish(fig,'group_profiles.png')
