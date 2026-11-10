"""把源码、数据与图表库打包成一个可以离线打开的 HTML。"""
from pathlib import Path
import json
import pandas as pd

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent

def prepare(path):
    frame = pd.read_csv(path)
    result = []
    core = ['核心VIP', '重要价值用户']
    potential = ['高收入高浏览低购买用户', '高潜沉睡用户', '犹豫型潜力用户', '高收入消费较高低活跃用户']
    for r in frame.to_dict('records'):
        record = {
            'id': r['User_ID'], 'age': r['Age'],
            'gender': {'Male':'男','Female':'女'}.get(r['Gender'],r['Gender']),
            'region': {'Urban':'城市','Suburban':'近郊','Rural':'乡村'}.get(r['Location'],r['Location']),
            'income': r['Income'], 'incomeLevel': {'Low':'低收入','Medium':'中收入','High':'高收入'}.get(r['Income_Level'],r['Income_Level']),
            'days': r['Last_Login_Days_Ago'], 'freq': r['Purchase_Frequency'],
            'spend': r['Total_Spending'], 'aov': r['Average_Order_Value'],
            'time': r['Time_Spent_on_Site_Minutes'], 'pages': r['Pages_Viewed'],
            'subscribed': bool(r['Newsletter_Subscription']), 'review': bool(r['Needs_Review']),
            'r': r['R_Score'], 'f': r['F_Score'], 'm': r['M_Score'], 'i': r['I_Score'],
            'base': r['RFM_Score'], 'score': r['Final_Score'],
            'segment': r.get('Segment_Name', r['User_Segment']),
            'group': '核心用户' if r['User_Segment'] in core else '潜力用户' if r['User_Segment'] in potential else '其他用户',
        }
        result.append(record)
    return result

for key,path in [('full',PROJECT/'outputs/improved/user_segments.csv'),('clean',PROJECT/'outputs/improved/exclude_85/user_segments.csv')]:
    # CSV 存在时重新生成；分享源码时也可以直接使用随附 JSON。
    if path.exists():
        (ROOT/'data'/f'{key}.json').write_text(json.dumps(prepare(path),ensure_ascii=False,separators=(',',':')),encoding='utf-8')
data = {key:json.loads((ROOT/'data'/f'{key}.json').read_text(encoding='utf-8')) for key in ['full','clean']}
assert len(data['full']) == 1000 and len(data['clean']) == 915
template = (ROOT/'src/template.html').read_text(encoding='utf-8')
licenses = '\n\n'.join((ROOT/'vendor'/name).read_text(encoding='utf-8') for name in ['ECHARTS-LICENSE.txt','ECHARTS-NOTICE.txt'])
for token, value in {
    '__STYLES__': (ROOT/'src/styles.css').read_text(encoding='utf-8'),
    '__ECHARTS__': (ROOT/'vendor/echarts.min.js').read_text(encoding='utf-8'),
    '__DATA__': json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('</','<\\/'),
    '__MATH__': (ROOT/'src/math.js').read_text(encoding='utf-8'),
    '__APP__': (ROOT/'src/app.js').read_text(encoding='utf-8'),
    '__LICENSES__': licenses.replace('</','<\\/'),
}.items():
    template = template.replace(token,value)
for path in [ROOT/'index.html']:
    path.write_text(template,encoding='utf-8')
print('Built', ROOT/'index.html', len(template.encode('utf-8')), 'bytes')
