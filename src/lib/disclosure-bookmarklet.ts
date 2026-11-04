// OK저축은행 홈페이지에서 관리자가 직접 누르는 즐겨찾기(북마클릿) 코드.
// 관리자가 보고 있는 화면(수시공시·결산/가결산공시 목록, 요약공시)을 읽어 okpr 가져오기 화면으로 넘긴다.
// 홈페이지 서버를 따로 호출하지 않고 이미 화면에 떠 있는 내용만 읽는다(봇 차단 우회 아님).
// 데이터는 URL 해시(#)로 넘겨 서버 로그에 남지 않게 한다.

const SOURCE = String.raw`(async()=>{
const O="__ORIGIN__";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=s=>(s||"").replace(/\s+/g," ").trim();
const route=(location.hash.split("?")[0]||"").replace("#/","");
const go=p=>{location.href=O+"/disclosure/import#"+btoa(unescape(encodeURIComponent(JSON.stringify(p))));};
const ymd=s=>String(s).replace(/(\d{4})(\d{2})(\d{2})/,"$1-$2-$3");
try{
if(route==="bankMngmAntm"||route==="bankMngmStac"){
  const kind=route==="bankMngmAntm"?"suisi":"result";
  const items=[...document.querySelectorAll("table tbody tr")].map(tr=>{
    const sc=window.angular&&angular.element(tr).scope();const d=sc&&sc.brdData;
    return d&&d.brdNo?{title:clean(d.brdTl),date:ymd(d.strtDy),url:location.origin+"/#/"+route+"Dtl?mastBrdNo="+d.mastBrdNo+"&brdNo="+d.brdNo}:null;
  }).filter(Boolean);
  if(!items.length){alert("목록을 읽지 못했습니다. 화면이 다 뜬 뒤 다시 눌러 주세요.");return;}
  go({kind,items});return;
}
if(route==="bankMngmSmryBsns"){
  const NAMES=["영업현황","재무현황","손익현황","기타"];
  const tabs=NAMES.map(n=>[...document.querySelectorAll("[role=tab],li,a,button")].find(e=>clean(e.textContent)===n));
  const tables=[];let disclosed="";
  for(let i=0;i<NAMES.length;i++){
    if(!tabs[i])continue;
    (tabs[i].querySelector("a,button")||tabs[i]).click();await sleep(1500);
    const tb=[...document.querySelectorAll("table")].find(t=>t.offsetParent!==null&&t.querySelector("tbody tr"));
    if(!tb)continue;
    let box=tb;while(box.parentElement&&!/공시일자/.test(box.innerText))box=box.parentElement;
    const lines=box.innerText.split("\n").map(clean).filter(Boolean);
    const dm=box.innerText.match(/공시일자\s*:\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if(dm&&!disclosed)disclosed=dm[1]+"-"+dm[2].padStart(2,"0")+"-"+dm[3].padStart(2,"0");
    const um=box.innerText.match(/\(단위\s*:\s*([^)]+)\)/);
    const period=[...new Set(lines.filter(l=>/^제\s?\d+\s?기/.test(l)))].join(" / ");
    const note=lines.filter(l=>/^\*/.test(l)).join("\n");
    const head=[...tb.querySelectorAll("thead tr")];
    const body=[...tb.querySelectorAll("tbody tr")];
    const hg=[];head.forEach((tr,ri)=>{hg[ri]=hg[ri]||[];let c=0;[...tr.children].forEach(td=>{while(hg[ri][c]!==undefined)c++;const rs=td.rowSpan||1,cs=td.colSpan||1,v=clean(td.innerText);for(let r=0;r<rs;r++)for(let k=0;k<cs;k++){hg[ri+r]=hg[ri+r]||[];hg[ri+r][c+k]=v;}c+=cs;});});
    const bg=[];body.forEach((tr,ri)=>{bg[ri]=bg[ri]||[];let c=0;[...tr.children].forEach(td=>{while(bg[ri][c]!==undefined)c++;const rs=td.rowSpan||1,cs=td.colSpan||1,v=clean(td.innerText);for(let r=0;r<rs;r++)for(let k=0;k<cs;k++){bg[ri+r]=bg[ri+r]||[];bg[ri+r][c+k]=(r===0&&k===0)?v:"";}c+=cs;});});
    const w=Math.max(...bg.map(r=>r.length),...hg.map(r=>r.length));
    const headers=[];for(let j=0;j<w;j++){const n=[...new Set(hg.map(r=>r[j]).filter(Boolean))].join(" ");headers.push(j>0&&n===headers[j-1]?"":n);}
    tables.push({name:NAMES[i],unit:um?clean(um[1]).replace(/\s*,\s*/g,", "):"",period,note,headers,rows:bg.map(r=>{const x=[];for(let j=0;j<w;j++)x.push(r[j]||"");return x;})});
  }
  if(!tables.length){alert("표를 읽지 못했습니다. 화면이 다 뜬 뒤 다시 눌러 주세요.");return;}
  const bm=(tables[0].period||"").match(/(\d{4}년\s*\d{1,2}월말)/);
  const base=bm?bm[1]:"";
  go({kind:"summary",title:(base?base+" ":"")+"요약 경영공시",disclosed_date:disclosed,table_data:{base_date:base,note:"",tables}});return;
}
alert("OK저축은행 홈페이지의 수시공시·결산/가결산공시·요약공시 화면에서 눌러 주세요.");
}catch(e){alert("가져오기 실패: "+e.message);}
})()`;

export function buildBookmarklet(origin: string) {
  return "javascript:" + encodeURIComponent(SOURCE.replace("__ORIGIN__", origin));
}

export const BOOKMARKLET_SOURCE = SOURCE;
