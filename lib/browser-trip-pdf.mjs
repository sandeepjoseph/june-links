import {createTripBrief,tripFilename} from './trip-brief.mjs';
export async function downloadTripBrief(data){
 const bytes=await createTripBrief(data,{loadAsset:async path=>{const res=await fetch(path);if(!res.ok)throw Error('The trip brief could not be prepared. Please try again.');return new Uint8Array(await res.arrayBuffer());}});
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
 const link=document.createElement('a');link.href=url;link.download=tripFilename(data);link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
