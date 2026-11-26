import sweph from 'sweph';
import {DAY_MS,timingPeriods,monthHorizon} from '../../timing-periods.mjs';
import {indiaToday} from '../../past-prediction.mjs';

export const EVENT_TIMING_METHOD='pilot-dasha-jupiter-transit-v1';
const SIGNS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const LORDS=['Mars','Venus','Mercury','Moon','Sun','Mercury','Venus','Mars','Jupiter','Saturn','Saturn','Jupiter'];
// Explicit product rules, not calibrated outcome probabilities. Houses and
// period/transit interpretation: PVR Narasimha Rao, Vedic Astrology: An
// Integrated Approach, Vimsottari Dasa and Transit Analysis sections:
// https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf
// Swiss sidereal positions: https://www.astro.com/swisseph/swephprg.htm
// The conjunction below is our
// conservative pilot selection policy, not a claim to reproduce his system.
const TOPICS={
 marriage:{primary:[7],relevant:[2,7,11],karakas:['Venus','Jupiter']},
 relationship:{primary:[5,7],relevant:[5,7],karakas:['Venus']},
 career:{primary:[10],relevant:[6,10,11],karakas:['Saturn','Sun']},
 money:{primary:[2,11],relevant:[2,11],karakas:['Jupiter']},
};
const C=sweph.constants;
const FLAGS=C.SEFLG_MOSEPH|C.SEFLG_SPEED|C.SEFLG_SIDEREAL;
const iso=milliseconds=>new Date(milliseconds).toISOString().slice(0,10);
const signIndex=longitude=>Math.floor(((longitude%360)+360)%360/30);
function longitude(date,id) {
 const jd=sweph.julday(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate(),
  date.getUTCHours()+date.getUTCMinutes()/60+date.getUTCSeconds()/3600,C.SE_GREG_CAL);
 const result=sweph.calc_ut(jd,id,FLAGS);
 if(result.error||!Number.isFinite(result.data?.[0]))throw Error('Timing ephemeris unavailable');
 return result.data[0];
}
function natalData(row,asOf) {
 const chart=row?.birth_chart;
 const birth=new Date(chart?.utc_time);
 const ascendant=SIGNS.indexOf(chart?.ascendant?.sign);
 if(row?.engine!=='local-sweph-v2'||row.isError||Object.hasOwn(row,'horary_number')||
  !Number.isFinite(+birth)||birth>asOf||ascendant<0||!Array.isArray(chart.planets))throw Error('Invalid natal timing evidence');
 // The bundled geocoder uses fixed offsets even for DST locations. Do not
 // produce timing forecasts from a birthplace whose historical offset is not
 // established. This pilot currently supports the bundled Indian city basis.
 const location=chart.location_used;
 if(location?.tzOffset!=='+05:30'||location.name==='Colombo')throw Error('Timing requires a verified historical birth timezone');
 const planets=new Map();
 for(const line of chart.planets) {
  const match=/^(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Rahu|Ketu): (\w+) ([\d.]+)° \| house (\d{1,2})\b/u.exec(line);
  if(!match||!SIGNS.includes(match[2])||planets.has(match[1]))throw Error('Incomplete natal timing evidence');
  const house=Number(match[4]),lon=Number(match[3]);
  if(!Number.isFinite(lon)||lon<0||lon>=360||house<1||house>12||SIGNS[signIndex(lon)]!==match[2]||house!==(signIndex(lon)-ascendant+12)%12+1)throw Error('Conflicting natal timing evidence');
  planets.set(match[1],{name:match[1],house,longitude:lon,adverse:/RETROGRADE|COMBUST|Debilitated/u.test(line)});
 }
 if(planets.size!==9)throw Error('Incomplete natal timing evidence');
 return {chart,birth,ascendant,planets};
}
function relevance(lord,natal,rule) {
 const planet=natal.planets.get(lord);
 const owned=rule.relevant.filter(house=>LORDS[(natal.ascendant+house-1)%12]===lord);
 const occupied=rule.relevant.includes(planet.house)?[planet.house]:[];
 const distances=lord==='Jupiter'?[5,7,9]:lord==='Saturn'?[3,7,10]:lord==='Mars'?[4,7,8]:['Rahu','Ketu'].includes(lord)?[]:[7];
 const aspected=rule.primary.filter(house=>distances.some(distance=>(planet.house+distance-2)%12+1===house));
 const pressureAspect=['Sun','Mars','Saturn'].includes(lord);
 const karaka=rule.karakas.includes(lord);
 const relevant=owned.length>0||occupied.length>0||(karaka&&!planet.adverse)||(aspected.length>0&&!pressureAspect);
 return {lord,relevant,owns_houses:owned,occupies_houses:occupied,aspects_houses:aspected,
  aspect_nature:aspected.length?(pressureAspect?'pressure':'support'):null,karaka,adverse_natal_condition:planet.adverse};
}
function dailyTransit(date,natal,rule) {
 const house=id=>(signIndex(longitude(date,id))-natal.ascendant+12)%12+1;
 const jupiter=house(C.SE_JUPITER),saturn=house(C.SE_SATURN);
 const jupiterHouses=[jupiter,...[5,7,9].map(distance=>(jupiter+distance-2)%12+1)];
 const activated=rule.primary.filter(target=>jupiterHouses.includes(target));
 const pressured=rule.primary.filter(target=>target===saturn||[3,7,10].some(distance=>(saturn+distance-2)%12+1===target));
 return {jupiter_house:jupiter,activated_houses:activated,saturn_house:saturn,saturn_pressure_houses:pressured};
}

export function calculateEventTiming(row,{topic,asOf=new Date(),horizonMonths=60,transits=dailyTransit}={}) {
 const checked=new Date(asOf);
 const result={schema:'astrology-timing-estimate-v1',method:EVENT_TIMING_METHOD,topic,
  classification:'experimental_astrological_estimate',precision:'month',as_of:Number.isFinite(+checked)?indiaToday(checked):null,
  status:'unavailable',windows:[],limits:'Estimated astrological periods, not guaranteed event dates or calibrated probabilities.'};
 const rule=TOPICS[topic];
 if(!rule)return {...result,status:'unsupported_topic'};
 try {
  if(!Number.isFinite(+checked))throw Error('Invalid timing clock');
  const natal=natalData(row,checked);
  const start=+new Date(result.as_of+'T00:00:00Z');
  const end=+monthHorizon(new Date(start),horizonMonths);
  sweph.set_sid_mode(C.SE_SIDM_LAHIRI,0,0);
  const moon=longitude(natal.birth,C.SE_MOON);
  if(Math.abs(((moon-natal.planets.get('Moon').longitude+540)%360)-180)>0.011)throw Error('Natal Moon conflicts with birth timestamp');
  const periods=timingPeriods(moon,natal.birth,new Date(start),new Date(end));
  const current=periods.find(period=>period.start<=+checked&&period.end>+checked);
  if(!current)throw Error('Current timing period unavailable');
  // Do not mix a corrected timing calendar with conflicting legacy period
  // evidence (notably the shortened first mahadasha in the old implementation).
  if(row.dasha?.current_mahadasha?.lord!==current.major||row.dasha?.current_antardasha?.lord!==current.minor)
   throw Error('Current period evidence conflicts with the timing calendar');
  result.horizon={from:iso(start),to:iso(end)};
  result.astronomy={ayanamsa:'LAHIRI',ephemeris:'MOSEPH',sampling_days:1,dasha_year_days:365.25};
  result.current_period_basis={major:relevance(current.major,natal,rule),minor:relevance(current.minor,natal,rule)};
  const windows=[];let open=null;
  const close=()=>{if(open&&open.end-open.start>=28*DAY_MS)windows.push(open);open=null;};
  for(let day=start;day<end;day+=DAY_MS) {
   const period=periods.find(p=>p.start<=day+DAY_MS/2&&p.end>day+DAY_MS/2);
   const minor=period&&relevance(period.minor,natal,rule);
   const major=period&&relevance(period.major,natal,rule);
   // A pressure-only minor lord does not become favorable by starting. A
   // relevant major lord AND a calculated Jupiter activation are required
   // before treating that combination as a mixed opportunity window.
   const linked=minor&&(minor.relevant||(minor.aspects_houses.length>0&&major.relevant&&!major.adverse_natal_condition));
   const marriageAge=topic==='marriage'&&day<+new Date(Date.UTC(natal.birth.getUTCFullYear()+18,natal.birth.getUTCMonth(),natal.birth.getUTCDate()));
   if(!period||!linked||marriageAge){close();continue;}
   const transit=transits(new Date(day+DAY_MS/2),natal,rule);
   if(!transit.activated_houses.length){close();continue;}
   const signature=JSON.stringify([period.major,period.minor,transit.jupiter_house,transit.activated_houses,transit.saturn_pressure_houses]);
   if(open?.signature!==signature) {
    close();const {saturn_house,...stableTransit}=transit;
    open={start:day,end:day+DAY_MS,signature,major,minor,transit:{...stableTransit,saturn_houses:[saturn_house]}};
   } else {open.end=day+DAY_MS;if(!open.transit.saturn_houses.includes(transit.saturn_house))open.transit.saturn_houses.push(transit.saturn_house);}
  }
  close();
  result.windows=windows.slice(0,3).map(window=>({
   topic,from:iso(window.start),to:iso(window.end-DAY_MS),precision:'month',estimated:true,
   basis:{major:window.major,minor:window.minor,transit:window.transit},
   qualification:'An astrologically supportive opportunity period; the event and its exact date are not established.',
  }));
  result.status=result.windows.length?'estimated_windows':'no_qualifying_window';
  return result;
 } catch(error) {return {...result,reason:error.message};}
}
