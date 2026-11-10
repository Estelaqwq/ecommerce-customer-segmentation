/* 只做计算，不操作页面；浏览器和自动检查使用同一份函数。 */
(function (root) {
  const groups = ['核心用户', '潜力用户', '其他用户'];
  const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
  const mean = (rows, key) => rows.length ? sum(rows, key) / rows.length : null;
  const score = (r, weight) => r.base * (1 + weight * r.i / 100);
  // 与 Notebook 一致：得分降序；同分时按字符串用户 ID 升序。
  const idCompare = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  function ranked(rows, weight) {
    return [...rows].sort((a,b) => score(b,weight)-score(a,weight) || idCompare(a,b));
  }
  function compare(rows, weight, requested) {
    const count = Math.min(requested, rows.length);
    const base = ranked(rows,0).slice(0,count), trial = ranked(rows,weight).slice(0,count);
    const baseIds = new Set(base.map(r=>r.id)), trialIds = new Set(trial.map(r=>r.id));
    const entered = trial.filter(r=>!baseIds.has(r.id)), left = base.filter(r=>!trialIds.has(r.id));
    return {count, base, trial, entered, left, overlap: count ? (count-entered.length)/count : null,
      avgSpend: mean(trial,'spend'), avgBrowse: mean(trial,'i')};
  }
  function scenario(n, p) {
    const sales = n*(p.p1-p.p0)*p.aov;
    const gross = sales*p.margin;
    const coupon = n*p.p1*p.coupon;
    const contact = n*p.contact;
    const cost = coupon+contact;
    const net = gross-cost;
    const slope = p.aov*p.margin-p.coupon;
    const threshold = slope > 0 ? (p.p0*p.aov*p.margin+p.contact)/slope : null;
    return {n,sales,gross,coupon,contact,cost,net,roi:cost>0?net/cost:null,
      breakeven:n>0 && threshold!==null && threshold>=0 && threshold<=1?threshold:null};
  }
  function matches(r, filters, brush=null) {
    if (filters.group && r.group!==filters.group) return false;
    if (filters.subscription && r.subscribed!==(filters.subscription==='yes')) return false;
    if (filters.segment && r.segment!==filters.segment) return false;
    if (filters.income && r.incomeLevel!==filters.income) return false;
    if (filters.review && !r.review) return false;
    if (filters.cell) {
      const i=Math.min(4,Math.floor(r.i/20));
      const f=r.freq<=2?0:r.freq<=5?1:2;
      if(i!==filters.cell[0] || f!==filters.cell[1]) return false;
    }
    if(brush && (r.base<brush[0][0] || r.base>brush[0][1] || r.i<brush[1][0] || r.i>brush[1][1])) return false;
    return true;
  }
  const api={groups,sum,mean,score,idCompare,ranked,compare,scenario,matches};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  root.DashboardMath=api;
})(typeof window!=='undefined'?window:globalThis);
