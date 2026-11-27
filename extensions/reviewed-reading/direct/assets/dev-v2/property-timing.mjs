// PVR Narasimha Rao, Vedic Astrology: An Integrated Approach, §§6.2.4,
// 7.2 and 8.2: D4 divisions, fourth-house property scope, Mars as significator.
// https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf
// The joint Rasi/D4 check below is an explicit pilot selection policy, not a
// calibrated probability, a classical event guarantee, or an electional chart.
const SIGNS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const LORDS=['Mars','Venus','Mercury','Moon','Sun','Mercury','Venus','Mars','Jupiter','Saturn','Saturn','Jupiter'];

export function chaturthamsaSign(longitude) {
 if(!Number.isFinite(longitude)||longitude<0||longitude>=360)throw Error('Invalid D4 longitude');
 const sign=Math.floor(longitude/30),quarter=Math.floor((longitude%30)/7.5);
 return (sign+quarter*3)%12;
}

export function propertyDivisionalChart(natal,checkedLongitude) {
 const ascendantLongitude=natal.chart.ascendant.longitude;
 if(!Number.isFinite(ascendantLongitude)||Math.floor(ascendantLongitude/30)!==natal.ascendant)
  throw Error('Conflicting property ascendant');
 // Ascendant is supplied to four decimals. Do not choose a D4 side from a
 // rounded value at a quarter boundary. Planet positions are recalculated.
 if(Math.min(ascendantLongitude%7.5,7.5-ascendantLongitude%7.5)<0.00011)
  throw Error('Property ascendant is on an unresolved D4 boundary');
 const ascendant=chaturthamsaSign(ascendantLongitude),planets=new Map();
 for(const [name,planet] of natal.planets) {
  const longitude=checkedLongitude(name);
  if(Math.abs(((longitude-planet.longitude+540)%360)-180)>0.011)
   throw Error('Property planet conflicts with birth timestamp');
  const sign=chaturthamsaSign(longitude);
  planets.set(name,{...planet,house:(sign-ascendant+12)%12+1});
 }
 return {ascendant,planets};
}

const primaryLink=period=>period.owns_houses.includes(4)||period.occupies_houses.includes(4)||
 (period.aspect_nature==='support'&&period.aspects_houses.includes(4));

export function propertyPeriodBasis(natal,divisional,major,minor,relevance,rule) {
 const rasiMajor=relevance(major,natal,rule),rasiMinor=relevance(minor,natal,rule);
 const d4Major=relevance(major,divisional,rule),d4Minor=relevance(minor,divisional,rule);
 const fourthLord=LORDS[(natal.ascendant+3)%12];
 return {eligible:(primaryLink(rasiMajor)||primaryLink(rasiMinor))&&(primaryLink(d4Major)||primaryLink(d4Minor)),
  basis:{method:'rasi-fourth-d4-v1',event:'property_purchase',
   rasi_fourth_lord:{lord:fourthLord,adverse_natal_condition:natal.planets.get(fourthLord).adverse},
   rasi_fourth_link:{major:primaryLink(rasiMajor),minor:primaryLink(rasiMinor)},
   d4:{method:'parasara-chaturthamsa-v1',ascendant_sign:SIGNS[divisional.ascendant],fourth_lord:LORDS[(divisional.ascendant+3)%12],
    major:d4Major,minor:d4Minor,fourth_link:{major:primaryLink(d4Major),minor:primaryLink(d4Minor)}}}};
}
