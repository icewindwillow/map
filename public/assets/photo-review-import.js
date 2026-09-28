import {assertPackage} from './photo-review-core.js';
export function installPhotoReviewImport({getPlaceId,isAvailable,setPhotos,api,compress,lock,message,backup}){
  const input=document.getElementById('review-package');if(!input)return;
  input.addEventListener('change',async()=>{
    const file=input.files[0];input.value='';if(!file||!isAvailable())return;
    let bundle;
    try{if(file.size>6*1024*1024)throw new Error('发布包过大，请从照片审核台重新导出。');bundle=assertPackage(JSON.parse(await file.text()));if(bundle.placeId!==getPlaceId())throw new Error(`地点不一致：此包属于 ${bundle.placeId}，请先切换到对应地点。`);}
    catch(e){message(e.message,true);return;}
    if(!confirm(`将当前地点相册替换为已审核的 ${bundle.photos.length} 张照片。先自动下载当前内容备份；上传后仍需点击“发布到地图”才会公开。继续吗？`))return;
    backup();lock(true);const next=[];
    try{
      // Decode and recompress before uploading: uploaded files contain no source EXIF.
      const prepared=[];for(const p of bundle.photos){const bytes=Uint8Array.from(atob(p.data.split(',')[1]),c=>c.charCodeAt(0));prepared.push({source:p,image:await compress(new File([bytes],'review.jpg',{type:'image/jpeg'}))});}
      for(const [i,{source:p,image}]of prepared.entries()){
        message(`正在上传已审核照片 ${i+1}/${prepared.length}…`);const result=await api('/author/api/photo',{data:image.data});
        next.push({...result.photo,width:image.width,height:image.height,caption:p.caption,alt:p.alt||'',credit:p.credit||'',...(p.sourceUrl?{sourceUrl:p.sourceUrl}:{})});
      }
      // Replace the local photo array only after every upload succeeds.
      setPhotos(next);message('已导入审核相册。故事、评价与坐标保持不变；检查后点击“发布到地图”。');
    }catch(e){message(`导入未完成，原相册仍保留。${e.message} 可重新选择发布包重试。`,true);}finally{lock(false);}
  });
}
