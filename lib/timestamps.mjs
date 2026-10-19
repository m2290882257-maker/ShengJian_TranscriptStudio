export function timestamp(seconds) {
  const total=Math.max(0,Math.round(seconds));
  return [Math.floor(total/3600),Math.floor(total/60)%60,total%60].map(n=>String(n).padStart(2,'0')).join(':');
}
export function segmentTranscript(segments) {
  return segments.filter(s=>['done','empty'].includes(s.status)).map(s=>
    `## [${timestamp(s.start)} – ${timestamp(s.end)}]\n\n${s.text.trim()||'（此段未返回文字，请对照录音检查是否静音或漏识别。）'}`
  ).join('\n\n');
}
export function parseSegments(csv, duration) {
  return csv.trim().split(/\r?\n/).filter(Boolean).map((line,index)=>{
    const [filename,from,to]=line.split(',');
    const start=Number(from), end=Math.min(Number(to),duration);
    if(!/^chunk-\d+\.m4a$/.test(filename)||!Number.isFinite(start)||!Number.isFinite(end))throw new Error('无法读取有效的音频分段时间。');
    if(start>=duration)return null; // Ignore an encoder-padding-only tail.
    if(end<=start)throw new Error('无法读取有效的音频分段时间。');
    return {index,filename,start,end,status:'pending',text:''};
  }).filter(Boolean);
}
