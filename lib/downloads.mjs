import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

export async function saveDownload(directory, filename, format, data) {
  let stem=String(filename||'转写文稿').split(/[\\/]/).pop().replace(/\.(mp3|mp4|m4a|wav|webm|ogg|flac|aac|mpeg|mpga|mov|mkv|wma|amr|opus|md|docx)$/i,'');
  stem=Array.from(stem.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').trim()).slice(0,100).join('')||'转写文稿';
  if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem))stem='_'+stem;
  await mkdir(directory,{recursive:true});
  for(let index=0;index<10000;index++){
    const name=stem+(index?` (${index})`:'')+'.'+format;
    const target=path.join(directory,name);
    try{await writeFile(target,data,{flag:'wx'});return {filename:name,path:target};}
    catch(e){if(e.code!=='EEXIST')throw new Error('无法保存到 download 文件夹，请检查磁盘空间与目录写入权限。');}
  }
  throw new Error('同名文件过多，请修改文件名。');
}
