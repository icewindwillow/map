// Older albums store “title: description” in one caption; newer ones also have alt.
export function photoText(photo,place=''){
  if(!photo)return {title:'',description:''};
  const caption=String(photo.caption||'').trim();
  const split=caption.match(/^([^：:\n]{1,45})[：:]\s*([\s\S]*)$/);
  if(split)return {title:split[1].trim(),description:split[2].trim()};
  return {title:String(photo.title||photo.alt||place||'').trim(),description:caption};
}
