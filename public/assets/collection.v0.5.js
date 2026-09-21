export function sortMemories(items, order='default') {
  if (!['rating-desc','rating-asc'].includes(order)) return [...items];
  const rated = v => typeof v==='number' && Number.isFinite(v) && v>=0 && v<=5;
  return items.map((m,i)=>({m,i})).sort((a,b)=>{
    const x=a.m.review?.rating,y=b.m.review?.rating;
    if(!rated(x))return rated(y)?1:a.i-b.i;
    if(!rated(y))return -1;
    return (order==='rating-desc'?y-x:x-y)||a.i-b.i;
  }).map(x=>x.m);
}
