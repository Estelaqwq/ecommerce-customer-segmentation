'use strict';
(() => {
  const M = window.DashboardMath, DATA = window.PROJECT_DATA;
  const $ = id => document.getElementById(id);
  const palette = {core:'#224e9b', potential:'#44a1d0', other:'#b6c8e1', ink:'#25456e', muted:'#8598b1', blue:'#245dbe', grid:'#edf1f7', red:'#bd7777'};
  const color = {'核心用户':palette.core,'潜力用户':palette.potential,'其他用户':palette.other};
  const shortNames = {'高收入消费较高低活跃用户':'高收入高消费低活跃','高收入高浏览低购买用户':'高收入高浏览低购买','低收入低浏览低消费用户':'低收入低浏览低消费'};
  const short = name => shortNames[name] || name;
  const nf = new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0});
  const number = (v,d=0) => v===null || !Number.isFinite(v) ? '—' : v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d});
  const pct = (v,d=1) => v===null || !Number.isFinite(v) ? '—' : number(v*100,d)+'%';
  const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = {model:'full', filters:{group:'',subscription:'',segment:'',income:'',review:false,cell:null},
    brush:null,brushActive:false,weight:.2,topK:200,movement:'entered',target:'potential',onlySubscribed:false,
    p:{p0:.01,p1:.05,margin:.4,coupon:10,contact:.5,aov:104.039},search:'',sort:'score',direction:-1,page:1};
  const charts = {}, chartTitles = {scatter:'价值与浏览分布',donut:'人群构成',radar:'人群特征对比',segments:'用户分层',behavior:'浏览 × 购买',flow:'用户构成路径',weights:'权重变化与名单稳定性',waterfall:'收益构成',sensitivity:'购买率 × 券额'};
  let rows=[], preBrush=[], currentComparison=null, scenarioRows=[], expanded=null, detailChart=null, selectedUser=null;
  let toastTimer, resizeTimer, renderTimer;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tooltip = {trigger:'item',confine:true,backgroundColor:'#fffffffa',borderColor:'#dce6f4',borderWidth:1,padding:[11,14],extraCssText:'box-shadow:0 5px 22px #14346b1b;border-radius:7px;',textStyle:{fontSize:11,color:'#426082'}};
  const baseOption = {animation:!reduced,animationDuration:450,animationDurationUpdate:200,textStyle:{fontFamily:'Segoe UI, Microsoft YaHei, sans-serif',color:palette.ink,fontSize:11},aria:{enabled:true},toolbox:{show:false},tooltip};
  const axis = {axisLine:{show:false},axisTick:{show:false},axisLabel:{color:palette.muted,fontSize:10},splitLine:{lineStyle:{color:palette.grid}},nameTextStyle:{color:palette.muted,fontSize:10},nameGap:27};
  const tt = (title,entries,note='') => `<div class="chart-tooltip"><b>${esc(title)}</b>${entries.map(([k,v])=>`<div class="tt-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}${note?`<div class="tt-note">${esc(note)}</div>`:''}</div>`;
  function chart(key) {
    if(!charts[key]) charts[key]=echarts.init($('chart-'+key),null,{renderer:'canvas',devicePixelRatio:Math.min(devicePixelRatio||1,2)});
    return charts[key];
  }
  function setChart(key,option,empty=false) {
    chart(key).setOption({...baseOption,...option,graphic:empty?[{type:'text',left:'center',top:'middle',style:{text:'当前筛选下暂无用户',fill:'#9badc3',fontSize:12,fontFamily:'Microsoft YaHei'}}]:option.graphic||[]},true);
  }
  function toast(message) {clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600);}
  function userTag(group) {return `<span class="group-tag tag-${group==='核心用户'?'core':group==='潜力用户'?'potential':'other'}">${esc(group)}</span>`;}
  function empty(message,detail='') {return `<div class="empty-state"><svg><use href="#icon-users"/></svg><span>${esc(message)}</span>${detail?`<small>${esc(detail)}</small>`:''}</div>`;}
  function dataset() {return DATA[state.model];}
  function population() {return dataset().filter(r=>M.matches(r,state.filters,state.brush));}
  function setFilter(key,value) {
    state.filters[key]=state.filters[key]===value?'':value;
    state.brush=null;state.brushActive=false;state.page=1;renderAll();
  }
  function updateScope() {
    $('scope-count').textContent=`当前 ${nf.format(rows.length)} / ${nf.format(dataset().length)} 人`;
    $('weight-scope').textContent=`当前 ${nf.format(rows.length)} 人 · 前 ${Math.min(state.topK,rows.length)} 名`;
    $('review-count').textContent=dataset().filter(r=>r.review).length;
    $('review-filter').classList.toggle('active',!!state.filters.review);
    $('review-filter').disabled=state.model==='clean';
    $('group-filter').value=state.filters.group;
    $('subscription-filter').value=state.filters.subscription;
    const segments=[...new Set(dataset().map(r=>r.segment))];
    $('segment-filter').innerHTML='<option value="">全部分层</option>'+segments.map(s=>`<option ${state.filters.segment===s?'selected':''} value="${esc(s)}">${esc(s)}</option>`).join('');
    const chips=[];
    for(const [key,label] of [['group','人群'],['subscription','订阅'],['segment','分层'],['income','收入']]) {
      if(state.filters[key]) chips.push([key,`${label}：${key==='subscription'?(state.filters[key]==='yes'?'已订阅':'未订阅'):state.filters[key]}`]);
    }
    if(state.filters.review) chips.push(['review','仅待核对']);
    if(state.filters.cell) chips.push(['cell','行为单元格']);
    if(state.brush) chips.push(['brush','散点框选']);
    $('filter-chips').innerHTML=chips.map(([key,label])=>`<button class="chip" data-clear="${key}" aria-label="移除${esc(label)}">${esc(label)} <span>×</span></button>`).join('');
    $('clear-brush').hidden=!state.brush;
    $('brush-toggle').classList.toggle('active',state.brushActive);
    $('brush-toggle').setAttribute('aria-pressed',String(state.brushActive));
  }
  function renderKpis() {
    const counts=Object.fromEntries(M.groups.map(g=>[g,rows.filter(r=>r.group===g).length]));
    const subscriptions=rows.filter(r=>r.subscribed).length;
    const data=[['用户总数',nf.format(rows.length),`覆盖当前模型 ${pct(rows.length/dataset().length)}`],
      ['核心用户',nf.format(counts['核心用户']),`当前人群占比 ${pct(rows.length?counts['核心用户']/rows.length:null)}`],
      ['潜力用户',nf.format(counts['潜力用户']),`当前人群占比 ${pct(rows.length?counts['潜力用户']/rows.length:null)}`],
      ['平均累计消费',number(M.mean(rows,'spend'),2),'原数据金额单位'],
      ['平均购买频次',number(M.mean(rows,'freq'),2),'用户历史汇总'],
      ['邮件订阅率',pct(rows.length?subscriptions/rows.length:null),`${nf.format(subscriptions)} 位已订阅用户`]];
    $('kpis').innerHTML=data.map(([label,value,note],i)=>`<article class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value" data-kpi="${i}">${value}</div><div class="kpi-note">${note}</div>${i===0?'<div class="kpi-deco"><svg><use href="#icon-users"/></svg></div>':''}</article>`).join('');
  }
  function renderScatter() {
    const c=chart('scatter');
    setChart('scatter',{
      grid:{left:54,right:24,top:20,bottom:47},
      xAxis:{...axis,type:'value',min:0,max:100,name:'基础 RFM 得分',nameLocation:'middle',interval:25},
      yAxis:{...axis,type:'value',min:0,max:100,name:'浏览得分',nameGap:10,interval:25},
      dataZoom:[{type:'inside',xAxisIndex:0,filterMode:'none',zoomOnMouseWheel:'ctrl',moveOnMouseWheel:false},{type:'inside',yAxisIndex:0,filterMode:'none',zoomOnMouseWheel:'ctrl',moveOnMouseWheel:false}],
      brush:{toolbox:[],xAxisIndex:0,yAxisIndex:0,brushType:'rect',brushMode:'single',transformable:true,throttleType:'debounce',throttleDelay:60,brushStyle:{borderWidth:1.3,color:'rgba(36,93,190,.08)',borderColor:'#4d83ca'},outOfBrush:{colorAlpha:.18}},
      tooltip:{...tooltip,formatter:p=>{const r=p.data.user;return tt(r.id,[['分层',r.segment],['基础 RFM',number(r.base,1)],['浏览得分',number(r.i,1)],['累计消费',number(r.spend)],['综合得分',number(M.score(r,state.weight),1)]]);}},
      series:[...M.groups].reverse().map(g=>({name:g,type:'scatter',symbolSize:g==='其他用户'?5.5:8,
        emphasis:{scale:1.7,focus:'series'},itemStyle:{color:color[g],opacity:g==='其他用户'?.62:.9},
        data:preBrush.filter(r=>r.group===g).map(r=>({value:[r.base,r.i],user:r}))}))
    },!preBrush.length);
    c.off('click');c.on('click',p=>p.data?.user&&openUser(p.data.user.id));
    c.off('brushEnd');c.on('brushEnd',event=>{
      const area=event.areas?.[0];
      state.brush=area?.coordRange || null;state.page=1;renderAll(true);
    });
    c.dispatchAction({type:'takeGlobalCursor',key:'brush',brushOption:{brushType:state.brushActive?'rect':false,brushMode:'single'}});
  }
  function renderGroups() {
    const counts=M.groups.map(g=>({name:g,value:rows.filter(r=>r.group===g).length,itemStyle:{color:color[g]}}));
    setChart('donut',{
      tooltip:{...tooltip,formatter:p=>tt(p.name,[['用户数',nf.format(p.value)],['占比',pct(rows.length?p.value/rows.length:null)]])},
      series:[{type:'pie',radius:['60%','78%'],center:['50%','49%'],padAngle:2,itemStyle:{borderRadius:4,borderColor:'#fff',borderWidth:2},
        label:{show:false},emphasis:{scale:true,scaleSize:7,label:{show:false}},data:counts.filter(r=>r.value)}],
      graphic:rows.length?[{type:'text',left:'center',top:'37%',style:{text:nf.format(rows.length),fill:'#204a84',font:'600 29px Segoe UI, sans-serif'}},
        {type:'text',left:'center',top:'54%',style:{text:'当前用户',fill:'#91a2b9',font:'11px Microsoft YaHei'}}]:[]
    },!rows.length);
    $('group-legend').innerHTML=counts.map(g=>`<button class="legend-entry" data-group="${g.name}"><i style="background:${color[g.name]}"></i>${g.name}<b>${pct(rows.length?g.value/rows.length:null)}</b></button>`).join('');
    chart('donut').off('click');chart('donut').on('click',p=>setFilter('group',p.name));
    const indicators=[{name:'登录活跃',max:100},{name:'购买频次',max:100},{name:'累计消费',max:100},{name:'浏览行为',max:100}];
    setChart('radar',{
      tooltip:{...tooltip,formatter:p=>tt(p.name,indicators.map((a,i)=>[a.name,number(p.value[i],1)]))},
      radar:{indicator:indicators,center:['50%','49%'],radius:'64%',splitNumber:4,axisName:{color:'#8096b4',fontSize:10},axisLine:{lineStyle:{color:'#e3ebf6'}},splitLine:{lineStyle:{color:'#e3ebf6'}},splitArea:{areaStyle:{color:['#fbfdff','#f5f9fe']}}},
      series:[{type:'radar',symbol:'circle',symbolSize:4,data:M.groups.filter(g=>counts.find(c=>c.name===g).value).map(g=>{
        const subset=rows.filter(r=>r.group===g);return {name:g,value:['r','f','m','i'].map(k=>M.mean(subset,k)),lineStyle:{color:color[g],width:g==='其他用户'?1.5:2},itemStyle:{color:color[g]},areaStyle:{color:color[g],opacity:.07}};
      })}]
    },!rows.length);
    $('radar-legend').innerHTML=M.groups.map(g=>`<span class="legend-dot ${g==='核心用户'?'core':g==='潜力用户'?'potential':'other'}"></span>${g}`).join('');
  }
  function renderSegments() {
    const map=new Map();rows.forEach(r=>{if(!map.has(r.segment)) map.set(r.segment,{name:r.segment,value:0,group:r.group});map.get(r.segment).value++;});
    const values=[...map.values()].sort((a,b)=>b.value-a.value);
    $('segment-caption').textContent=`${values.length} 类用户 · 点击筛选`;
    setChart('segments',{
      grid:{left:143,right:40,top:9,bottom:26},xAxis:{...axis,type:'value',minInterval:1,splitNumber:3},
      yAxis:{...axis,type:'category',inverse:true,data:values.map(v=>v.name),axisLabel:{color:'#7b90ae',fontSize:10,formatter:short},splitLine:{show:false}},
      tooltip:{...tooltip,formatter:p=>tt(p.name,[['用户数',nf.format(p.value)],['占比',pct(rows.length?p.value/rows.length:null)]])},
      series:[{type:'bar',barMaxWidth:12,showBackground:true,backgroundStyle:{color:'#f8fafd',borderRadius:2},
        label:{show:true,position:'right',fontSize:10,color:'#7d93b1'},itemStyle:{borderRadius:[0,2,2,0]},data:values.map(v=>({value:v.value,itemStyle:{color:color[v.group]}}))}]
    },!rows.length);
    chart('segments').off('click');chart('segments').on('click',p=>setFilter('segment',p.name));
  }
  function renderBehavior() {
    const cells=Array.from({length:15},(_,n)=>[n%5,Math.floor(n/5),0]);
    rows.forEach(r=>{const x=Math.min(4,Math.floor(r.i/20)),y=r.freq<=2?0:r.freq<=5?1:2;cells[y*5+x][2]++;});
    const labels=['0–20','20–40','40–60','60–80','80–100'];
    const yLabels=['0–2 次','3–5 次','6–9 次'];
    setChart('behavior',{
      grid:{left:61,right:18,top:32,bottom:79},
      xAxis:{...axis,type:'category',data:labels,name:'浏览得分',nameLocation:'middle',nameGap:27,splitArea:{show:true},axisLabel:{fontSize:9,color:palette.muted}},
      yAxis:{...axis,type:'category',data:yLabels,splitArea:{show:true},name:'购买频次',nameGap:14},
      visualMap:{min:0,max:Math.max(1,...cells.map(c=>c[2])),calculable:false,orient:'horizontal',left:'center',bottom:4,itemWidth:8,itemHeight:130,text:['多','少'],textStyle:{color:palette.muted,fontSize:9},inRange:{color:['#f0f5fc','#b7d4f1','#5b97d1','#22559d']}},
      tooltip:{...tooltip,formatter:p=>tt('行为交叉',[['浏览得分',labels[p.value[0]]],['购买频次',yLabels[p.value[1]]],['用户数',p.value[2]]],'区间左闭右开，100 分归入最后一档')},
      series:[{type:'heatmap',data:cells,label:{show:true,fontSize:12},itemStyle:{borderWidth:4,borderColor:'#fff',borderRadius:4},emphasis:{itemStyle:{borderColor:'#9fc4ef',borderWidth:2}}}]
    },!rows.length);
    chart('behavior').off('click');chart('behavior').on('click',p=>{const cell=p.value.slice(0,2);state.filters.cell=JSON.stringify(cell)===JSON.stringify(state.filters.cell)?null:cell;state.brush=null;state.page=1;renderAll();});
  }
  function renderFlow() {
    const links=new Map(), nodes=new Map();
    function addNode(id,name,depth,fill){if(!nodes.has(id))nodes.set(id,{name:id,displayName:name,depth,itemStyle:{color:fill,borderWidth:0}});}
    function addLink(a,b){const key=a+'|'+b;links.set(key,(links.get(key)||0)+1);}
    rows.forEach(r=>{
      const a='income:'+r.incomeLevel,b='group:'+r.group,c='sub:'+(r.subscribed?'yes':'no');
      addNode(a,r.incomeLevel,0,{'低收入':'#c5d4e9','中收入':'#8eafd9','高收入':'#5b88c4'}[r.incomeLevel]||'#9ab6da');
      addNode(b,r.group,1,color[r.group]);addNode(c,r.subscribed?'已订阅':'未订阅',2,r.subscribed?'#4d8fc0':'#b8c9de');
      addLink(a,b);addLink(b,c);
    });
    setChart('flow',{
      tooltip:{...tooltip,formatter:p=>p.dataType==='edge'?tt('用户构成',[[p.data.source.split(':')[1]+' → '+(p.data.target.startsWith('sub:')?(p.data.target.endsWith('yes')?'已订阅':'未订阅'):p.data.target.split(':')[1]),nf.format(p.data.value)+' 人']]):tt(p.data.displayName,[['用户数',number(p.value)]])},
      series:[{type:'sankey',left:21,right:71,top:27,bottom:28,nodeWidth:9,nodeGap:20,layoutIterations:32,draggable:false,emphasis:{focus:'adjacency'},
        label:{color:'#7086a5',fontSize:10,formatter:p=>p.data.displayName},lineStyle:{color:'source',opacity:.22,curveness:.5},
        data:[...nodes.values()],links:[...links].map(([key,value])=>({source:key.split('|')[0],target:key.split('|')[1],value}))}]
    },!rows.length);
    chart('flow').off('click');chart('flow').on('click',p=>{if(p.dataType!=='node')return;const [type,value]=p.name.split(':');setFilter(type==='group'?'group':type==='sub'?'subscription':'income',value);});
  }
  function renderWeight() {
    currentComparison=M.compare(rows,state.weight,state.topK);
    $('weight-value').textContent=pct(state.weight,0);$('overlap').textContent=pct(currentComparison.overlap);
    $('replaced').textContent=number(currentComparison.entered.length);$('rank-spend').textContent=number(currentComparison.avgSpend,0);$('rank-browse').textContent=number(currentComparison.avgBrowse,1);
    $('weight-scope').textContent=`当前 ${nf.format(rows.length)} 人 · 前 ${currentComparison.count} 名`;
    const weights=Array.from({length:11},(_,i)=>i*.05);
    const compare=weights.map(w=>M.compare(rows,w,state.topK));
    setChart('weights',{
      grid:{left:53,right:52,top:56,bottom:55},
      legend:{data:['名单重合率','入选平均浏览分'],top:8,left:'center',itemWidth:17,itemHeight:7,textStyle:{color:'#8295af',fontSize:10}},
      tooltip:{...tooltip,trigger:'axis',formatter:items=>{const index=items[0].dataIndex,comparison=compare[index];return tt(`浏览权重 ${pct(weights[index],0)}`,[['名单重合率',pct(comparison.overlap)],['替换人数',number(comparison.entered.length)],['平均浏览分',number(comparison.avgBrowse,1)],['平均累计消费',number(comparison.avgSpend,2)]]);}},
      xAxis:{...axis,type:'value',min:0,max:50,interval:10,name:'浏览最高加分幅度',nameLocation:'middle',axisLabel:{color:palette.muted,fontSize:10,formatter:v=>v+'%'}},
      yAxis:[{...axis,type:'value',min:0,max:100,interval:25,name:'重合率',nameGap:17,axisLabel:{color:palette.muted,fontSize:10,formatter:v=>v+'%'}},
             {...axis,type:'value',min:0,max:100,interval:25,name:'浏览分',nameGap:17,splitLine:{show:false}}],
      series:[{name:'名单重合率',type:'line',smooth:.15,symbol:'circle',symbolSize:5,lineStyle:{width:2.5,color:palette.blue},itemStyle:{color:palette.blue},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#d9e7fb88'},{offset:1,color:'#f4f8ff00'}])},
        data:compare.map((c,i)=>[weights[i]*100,c.overlap===null?null:c.overlap*100]),markLine:{symbol:'none',silent:true,lineStyle:{type:'dashed',color:'#a1b7d6'},label:{formatter:pct(state.weight,0),color:'#688bb8',fontSize:10},data:[{xAxis:state.weight*100}]}},
        {name:'入选平均浏览分',type:'line',yAxisIndex:1,smooth:.15,symbol:'circle',symbolSize:4,lineStyle:{width:2,type:'dashed',color:palette.potential},itemStyle:{color:palette.potential},data:compare.map((c,i)=>[weights[i]*100,c.avgBrowse])}]
    },!rows.length);
    renderMovement();
  }
  function renderMovement() {
    const list=currentComparison[state.movement];
    document.querySelectorAll('[data-movement]').forEach(b=>b.classList.toggle('active',b.dataset.movement===state.movement));
    if(!list.length){$('movement-list').innerHTML=empty('名单未发生变化',currentComparison.count?`当前入选 ${currentComparison.count} 人`:'请调整筛选条件');return;}
    $('movement-list').innerHTML='<div class="movement-header"><span>用户 / 分层</span><span>基础分</span><span>综合分</span></div>'+list.slice(0,5).map(r=>`<button class="movement-item" data-user="${esc(r.id)}"><div><strong>${esc(r.id)}</strong><small>${esc(short(r.segment))}</small></div><span>${number(r.base,1)}</span><b>${number(M.score(r,state.weight),1)}</b></button>`).join('');
  }
  function targets() {
    let selected=state.target==='potential'?rows.filter(r=>r.group==='潜力用户'):state.target==='core'?rows.filter(r=>r.group==='核心用户'):state.target==='ranked'?currentComparison.trial:rows;
    return state.onlySubscribed?selected.filter(r=>r.subscribed):selected;
  }
  function renderScenario() {
    scenarioRows=targets();
    const result=M.scenario(scenarioRows.length,state.p);
    $('target-count').textContent=number(result.n);$('net-profit').textContent=number(result.net,2);$('net-profit').classList.toggle('negative',result.net<0);
    $('roi').textContent=result.roi===null?'未定义':pct(result.roi);
    $('break-even').textContent=!result.n?'—':result.breakeven===null?'不可达':pct(result.breakeven,2);
    const parts=[['增量毛利',0,result.gross,result.gross],['优惠券成本',result.gross,result.gross-result.coupon,-result.coupon],['联系成本',result.gross-result.coupon,result.net,-result.contact],['增量净收益',0,result.net,result.net]];
    setChart('waterfall',{
      grid:{left:62,right:20,top:24,bottom:43},
      xAxis:{...axis,type:'category',data:parts.map(p=>p[0]),axisLabel:{color:palette.muted,fontSize:10}},
      yAxis:{...axis,type:'value',splitNumber:4,scale:false},
      tooltip:{...tooltip,formatter:p=>tt(parts[p.dataIndex][0],[['金额',number(parts[p.dataIndex][3],2)],['目标用户',nf.format(result.n)]])},
      series:[{type:'custom',data:parts.map((p,i)=>[i,p[1],p[2],p[3]]),encode:{x:0,y:[1,2]},
        renderItem:(params,api)=>{
          const i=api.value(0),start=api.coord([i,api.value(1)]),end=api.coord([i,api.value(2)]),amount=api.value(3);
          const width=api.size([1,0])[0]*.48;
          const rect=echarts.graphic.clipRectByRect({x:start[0]-width/2,y:Math.min(start[1],end[1]),width,height:Math.max(1,Math.abs(start[1]-end[1]))},params.coordSys);
          const fill=i===3?(amount<0?palette.red:palette.blue):i===0?palette.potential:'#b6c9e3';
          return {type:'group',children:[{type:'rect',shape:rect,style:{fill},emphasis:{style:{opacity:.8}}},
            {type:'text',style:{x:start[0],y:Math.min(start[1],end[1])-9,text:number(amount,2),textAlign:'center',textVerticalAlign:'bottom',font:'11px Segoe UI, Microsoft YaHei',fill:'#6a819e'}}]};
        }}]
    });
    const rates=[0,.01,.02,.03,.05,.1,.15,.2];const coupons=[0,5,10,15,20];
    const cells=[];coupons.forEach((coupon,y)=>rates.forEach((p1,x)=>cells.push([x,y,M.scenario(result.n,{...state.p,p1,coupon}).net])));
    const max=Math.max(1,...cells.map(v=>Math.abs(v[2])));
    setChart('sensitivity',{
      grid:{left:48,right:20,top:28,bottom:78},
      xAxis:{...axis,type:'category',data:rates.map(r=>pct(r,0)),name:'假设发券后购买率',nameLocation:'middle',nameGap:28,axisLabel:{color:palette.muted,fontSize:9}},
      yAxis:{...axis,type:'category',data:coupons,name:'券额',nameGap:15,axisLabel:{color:palette.muted,fontSize:10}},
      visualMap:{min:-max,max,calculable:false,orient:'horizontal',left:'center',bottom:2,itemHeight:150,itemWidth:8,text:['盈利','亏损'],textStyle:{color:palette.muted,fontSize:9},inRange:{color:['#bf7f7f','#f8fafd','#376db1']}},
      tooltip:{...tooltip,formatter:p=>tt('净收益情景',[['发券后购买率',pct(rates[p.value[0]],0)],['优惠券额',number(coupons[p.value[1]])],['预计增量净收益',number(p.value[2],2)]],'点击应用这组假设')},
      series:[{type:'heatmap',data:cells,label:{show:true,fontSize:9,formatter:p=>number(p.value[2],0)},itemStyle:{borderWidth:3,borderColor:'#fff',borderRadius:3},emphasis:{itemStyle:{borderWidth:2,borderColor:'#76a6df'}}}]
    });
    chart('sensitivity').off('click');chart('sensitivity').on('click',p=>{state.p.p1=rates[p.value[0]];state.p.coupon=coupons[p.value[1]];syncScenarioInputs();renderScenario();toast(`已应用：购买率 ${pct(state.p.p1,0)}，券额 ${number(state.p.coupon)}`);});
  }
  function tableRows() {
    const search=state.search.trim().toLowerCase();
    return rows.filter(r=>!search || `${r.id} ${r.segment} ${r.group}`.toLowerCase().includes(search)).sort((a,b)=>{
      if(state.sort==='id')return state.direction*M.idCompare(a,b);
      const delta=state.sort==='score'?M.score(a,state.weight)-M.score(b,state.weight):a[state.sort]-b[state.sort];
      return state.direction*delta || M.idCompare(a,b);
    });
  }
  function renderTable() {
    const list=tableRows(),size=10,totalPages=Math.max(1,Math.ceil(list.length/size));
    state.page=Math.min(state.page,totalPages);
    const selected=list.slice((state.page-1)*size,state.page*size);
    $('user-tbody').innerHTML=selected.length?selected.map(r=>`<tr data-user="${esc(r.id)}" tabindex="0" aria-label="查看 ${esc(r.id)} 的用户详情"><td>${esc(r.id)}</td><td>${esc(short(r.segment))}</td><td>${userTag(r.group)}</td><td>${number(r.spend,0)}</td><td>${r.freq}</td><td>${number(r.i,1)}</td><td>${number(M.score(r,state.weight),1)}</td><td><span class="sub-tag ${r.subscribed?'yes':''}">${r.subscribed?'已订阅':'未订阅'}</span></td><td class="${r.review?'review-text':''}">${r.review?'待核对':'未标记'}</td></tr>`).join(''):'<tr><td colspan="9" style="height:120px;text-align:center;color:#92a4bc">没有符合条件的用户</td></tr>';
    $('table-count').textContent=`共 ${nf.format(list.length)} 位用户${state.search?'（搜索结果）':''}`;
    $('page-info').textContent=`${state.page} / ${totalPages}`;
    $('prev-page').disabled=state.page<=1;$('next-page').disabled=state.page>=totalPages;
    document.querySelectorAll('[data-sort]').forEach(b=>b.querySelector('span').textContent=b.dataset.sort===state.sort?(state.direction===-1?'↓':'↑'):'↕');
  }
  function renderAll(skipScatter=false) {
    preBrush=dataset().filter(r=>M.matches(r,state.filters));rows=population();
    updateScope();renderKpis();if(!skipScatter)renderScatter();
    renderGroups();renderSegments();renderBehavior();renderFlow();renderWeight();renderScenario();renderTable();
  }
  function download(content,name,type) {
    const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function csvExport(list,label) {
    const keys=[['用户ID','id'],['年龄','age'],['性别','gender'],['地区','region'],['用户分层','segment'],['人群类型','group'],['累计消费','spend'],['购买频次','freq'],['浏览得分','i'],['基础RFM得分','base'],['综合得分','score'],['邮件订阅','subscribed'],['待核对','review']];
    const quote=v=>'"'+String(v).replace(/"/g,'""')+'"';
    const lines=[keys.map(k=>quote(k[0])).join(',')];
    list.forEach(r=>lines.push(keys.map(([,k])=>quote(k==='score'?M.score(r,state.weight).toFixed(4):r[k])).join(',')));
    download('\ufeff'+lines.join('\r\n'),`${label}_${state.model}_权重${Math.round(state.weight*100)}.csv`,'text/csv;charset=utf-8');toast(`已导出 ${nf.format(list.length)} 位用户`);
  }
  function openUser(id) {
    const r=dataset().find(user=>user.id===id);if(!r)return;selectedUser=id;
    $('detail-title').textContent=r.id;
    const facts=[['用户分层',r.segment],['年龄 / 性别',`${r.age} / ${r.gender}`],['地区',r.region],['收入层级',r.incomeLevel],['累计消费',number(r.spend)],['购买频次',r.freq+' 次'],['最近登录',r.days+' 天前'],['浏览时长',r.time+' 分钟'],['浏览页数',r.pages+' 页'],['邮件订阅',r.subscribed?'已订阅':'未订阅']];
    $('detail-content').innerHTML=`<div class="detail-info"><div class="detail-tags">${userTag(r.group)}${r.review?'<span class="review-text" style="font-size:11px">消费口径待核对</span>':''}</div><div class="detail-facts">${facts.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div><div class="detail-scores"><div><span>基础 RFM</span><b>${number(r.base,1)}</b></div><div><span>综合得分 · 权重 ${pct(state.weight,0)}</span><b>${number(M.score(r,state.weight),1)}</b></div></div></div>`;
    if(!$('detail-dialog').open)$('detail-dialog').showModal();
    if(!detailChart)detailChart=echarts.init($('chart-detail'));
    detailChart.resize();detailChart.setOption({...baseOption,radar:{indicator:['登录活跃','购买频次','累计消费','浏览行为'].map(name=>({name,max:100})),radius:'62%',axisName:{color:'#8296b0',fontSize:11},splitArea:{areaStyle:{color:['#f8fbff','#eff5fd']}},splitLine:{lineStyle:{color:'#e4edf8'}},axisLine:{lineStyle:{color:'#e4edf8'}}},series:[{type:'radar',data:[{name:r.id,value:[r.r,r.f,r.m,r.i]}],lineStyle:{color:palette.blue,width:2},itemStyle:{color:palette.blue},areaStyle:{color:palette.blue,opacity:.12},symbolSize:5}]},true);
  }
  function expandChart(key) {
    $('expanded-title').textContent=chartTitles[key];$('chart-dialog').showModal();
    if(expanded)expanded.dispose();expanded=echarts.init($('chart-expanded'));
    const option=charts[key].getOption();
    if(key==='segments') option.grid[0].left=190;
    expanded.setOption(option,true);expanded.resize();
  }
  function syncScenarioInputs() {
    for(const key of ['p0','p1','margin','coupon','contact','aov']) $(key).value=numberForInput(state.p[key]*(key==='p0'||key==='p1'||key==='margin'?100:1));
    $('target').value=state.target;$('only-subscribed').checked=state.onlySubscribed;
  }
  const numberForInput=v=>String(Number(v.toFixed(6)));
  function resetFilters() {state.filters={group:'',subscription:'',segment:'',income:'',review:false,cell:null};state.brush=null;state.brushActive=false;state.page=1;state.search='';$('user-search').value='';renderAll();}

  // 全局筛选与图表选择。
  $('model').addEventListener('change',e=>{state.model=e.target.value;resetFilters();toast(state.model==='clean'?'已切换至 915 人重算模型':'已切换至 1,000 人全样本模型');});
  for(const [id,key] of [['group-filter','group'],['subscription-filter','subscription'],['segment-filter','segment']]) $(id).addEventListener('change',e=>{state.filters[key]=e.target.value;state.brush=null;state.brushActive=false;state.page=1;renderAll();});
  $('review-filter').addEventListener('click',()=>{state.filters.review=!state.filters.review;state.brush=null;state.page=1;renderAll();});
  $('reset-filters').addEventListener('click',resetFilters);
  $('filter-chips').addEventListener('click',e=>{const b=e.target.closest('[data-clear]');if(!b)return;const key=b.dataset.clear;if(key==='brush')state.brush=null;else state.filters[key]=key==='review'?false:key==='cell'?null:'';state.brushActive=false;state.page=1;renderAll();});
  $('group-legend').addEventListener('click',e=>{const b=e.target.closest('[data-group]');if(b)setFilter('group',b.dataset.group);});
  $('brush-toggle').addEventListener('click',()=>{state.brushActive=!state.brushActive;updateScope();charts.scatter.dispatchAction({type:'takeGlobalCursor',key:'brush',brushOption:{brushType:state.brushActive?'rect':false,brushMode:'single'}});if(state.brushActive)toast('在散点图中拖动框选用户');});
  $('clear-brush').addEventListener('click',()=>{state.brush=null;state.brushActive=false;state.page=1;renderAll();});
  $('weight-input').addEventListener('input',e=>{state.weight=Number(e.target.value)/100;clearTimeout(renderTimer);renderTimer=setTimeout(()=>{renderWeight();renderScenario();renderTable();},30);$('weight-value').textContent=pct(state.weight,0);});
  $('top-k').addEventListener('change',e=>{state.topK=Number(e.target.value);renderWeight();renderScenario();});
  $('reset-weight').addEventListener('click',()=>{state.weight=.2;state.topK=200;$('weight-input').value=20;$('top-k').value=200;renderWeight();renderScenario();renderTable();});
  document.querySelectorAll('[data-movement]').forEach(b=>b.addEventListener('click',()=>{state.movement=b.dataset.movement;renderMovement();}));
  $('target').addEventListener('change',e=>{state.target=e.target.value;renderScenario();});
  $('only-subscribed').addEventListener('change',e=>{state.onlySubscribed=e.target.checked;renderScenario();});
  for(const key of ['p0','p1','margin','coupon','contact','aov']) $(key).addEventListener('input',e=>{
    const input=e.target;if(input.value===''||!input.validity.valid)return;
    state.p[key]=Number(input.value)/(key==='p0'||key==='p1'||key==='margin'?100:1);
    clearTimeout(renderTimer);renderTimer=setTimeout(renderScenario,60);
  });
  for(const key of ['p0','p1','margin','coupon','contact','aov']) $(key).addEventListener('blur',()=>syncScenarioInputs());
  $('reset-scenario').addEventListener('click',()=>{state.p={p0:.01,p1:.05,margin:.4,coupon:10,contact:.5,aov:104.039};state.target='potential';state.onlySubscribed=false;syncScenarioInputs();renderScenario();});
  $('user-search').addEventListener('input',e=>{state.search=e.target.value;state.page=1;renderTable();});
  document.querySelectorAll('[data-sort]').forEach(b=>b.addEventListener('click',()=>{if(state.sort===b.dataset.sort)state.direction*=-1;else{state.sort=b.dataset.sort;state.direction=-1;}state.page=1;renderTable();}));
  $('prev-page').addEventListener('click',()=>{state.page--;renderTable();});$('next-page').addEventListener('click',()=>{state.page++;renderTable();});
  document.body.addEventListener('click',e=>{const user=e.target.closest('[data-user]');if(user)openUser(user.dataset.user);});
  $('user-tbody').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.dataset.user)openUser(e.target.dataset.user);});
  $('export-users').addEventListener('click',()=>csvExport(tableRows(),'筛选用户'));
  $('export-ranking').addEventListener('click',()=>csvExport(currentComparison.trial,'加权入选名单'));
  document.querySelectorAll('.chart-expand').forEach(b=>b.addEventListener('click',()=>expandChart(b.dataset.chart)));
  document.querySelectorAll('.chart-download').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.chart;const a=document.createElement('a');a.href=charts[key].getDataURL({type:'png',pixelRatio:3,backgroundColor:'#fff'});a.download=chartTitles[key]+'.png';a.click();toast('图表已导出为 PNG');}));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  for(const id of ['chart-dialog','detail-dialog','method-dialog']) $(id).addEventListener('click',e=>{const r=e.currentTarget.getBoundingClientRect();if(e.target===e.currentTarget&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))e.currentTarget.close();});
  for(const id of ['method-button','footer-method','assumption-button']) $(id).addEventListener('click',()=>$('method-dialog').showModal());
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前浏览器不支持全屏，可使用 F11');}});
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{Object.values(charts).forEach(c=>c.resize());expanded?.resize();detailChart?.resize();},90);});
  const observer=new IntersectionObserver(entries=>{const active=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!active)return;document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('active',a.dataset.section===active.target.id));},{rootMargin:'-12% 0px -52% 0px',threshold:[0,.1,.3]});
  document.querySelectorAll('main>.section').forEach(section=>observer.observe(section));
  renderAll();
  // 便于在浏览器控制台检查模型与计算；不向任何服务器发送数据。
  window.__dashboard={state,charts,getRows:()=>rows,getComparison:()=>currentComparison,getScenario:()=>M.scenario(targets().length,state.p),render:renderAll};
})();
