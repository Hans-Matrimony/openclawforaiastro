// Separate from the legacy renderer: retain the full first mahadasha's start,
// including the portion elapsed before birth, before subdividing it.
export const DASHA_ORDER=['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'];
export const DASHA_YEARS={Ketu:7,Venus:20,Sun:6,Moon:10,Mars:7,Rahu:18,Jupiter:16,Saturn:19,Mercury:17};
export const DAY_MS=86400000;
const YEAR_MS=365.25*DAY_MS;

export function timingPeriods(moonLongitude,birthDate,fromDate,toDate) {
 const birth=+new Date(birthDate),from=+new Date(fromDate),to=+new Date(toDate);
 if(!Number.isFinite(moonLongitude)||moonLongitude<0||moonLongitude>=360||
   ![birth,from,to].every(Number.isFinite)||from<birth||to<=from||to>birth+150*YEAR_MS) throw Error('Invalid timing interval');
 const span=360/27,index=Math.floor(moonLongitude/span);
 const elapsed=(moonLongitude-index*span)/span;
 const first=index%9;
 let start=birth-elapsed*DASHA_YEARS[DASHA_ORDER[first]]*YEAR_MS;
 const result=[];
 for(let cycle=0;cycle<20&&start<to;cycle++) {
  const major=DASHA_ORDER[(first+cycle)%9],length=DASHA_YEARS[major]*YEAR_MS;
  const end=start+length;
  if(end>from) {
   const majorIndex=DASHA_ORDER.indexOf(major);
   let offset=0;
   for(let i=0;i<9;i++) {
    const minor=DASHA_ORDER[(majorIndex+i)%9];
    const subStart=start+offset;
    offset+=length*DASHA_YEARS[minor]/120;
    const subEnd=i===8?end:start+offset;
    if(subEnd>from&&subStart<to)result.push({major,minor,start:subStart,end:subEnd,
      major_start:start,major_end:end});
   }
  }
  start=end;
 }
 return result;
}

export function monthHorizon(fromDate,months) {
 const date=new Date(fromDate);
 if(!Number.isFinite(+date)||!Number.isInteger(months)||months<1||months>60)throw Error('Invalid timing horizon');
 const end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+months,1));
 const lastDay=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();
 end.setUTCDate(Math.min(date.getUTCDate(),lastDay));
 return end;
}
