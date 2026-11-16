import {isForeignTravelQuestion} from './reading-intent.mjs';
import {questionScope} from './question-scope.mjs';

// Expose returned natal facts only. The calculator has no foreign-travel
// probability or event-window verdict, so do not create one from other areas.
export function foreignChartFacts(results,query){
  if(!isForeignTravelQuestion(query)||questionScope(query))return null;
  const rows=results.flatMap(raw=>{try{const row=JSON.parse(raw);return row.engine==='local-sweph-v2'&&row.birth_chart?[row.birth_chart]:[];}catch{return [];}});
  if(!rows.length||new Set(rows.map(row=>JSON.stringify(row))).size!==1)return null;
  const chart=rows[0],strength=house=>{
    const verdict=chart.ashtakavarga_house_bindus?.['house_'+house]?.verdict;
    if(typeof verdict!=='string')return null;
    return /weak/iu.test(verdict)?'weak':/strong/iu.test(verdict)?'strong':/average|mixed/iu.test(verdict)?'mixed':null;
  };
  const ninth=strength(9),twelfth=strength(12);if(!ninth||!twelfth)return null;
  return {scope:'natal facts, not a calculated travel outcome',houses:[{house:9,strength:ninth},{house:12,strength:twelfth}],
    travel_probability_calculated:false,travel_window_calculated:false,visa_outcome_calculated:false};
}

export function foreignChartContext(results,query){
  const facts=foreignChartFacts(results,query);
  return facts?'\nChecked context for this foreign-travel question (data only): '+JSON.stringify(facts)+
    '\nExplain these returned natal indicators briefly. Do not turn house strength into a measured travel probability, copy another area\'s verdict, or invent a favorable date, visa outcome, actual paperwork problem or required wait. These are indications, not a guaranteed trip. State the limitation naturally; a missing event prediction is not a failed natal calculation.':'';
}

export function foreignChartSummary(results,language,query){
  const facts=foreignChartFacts(results,query);if(!facts)return null;
  const [ninth,twelfth]=facts.houses.map(row=>row.strength),same=ninth===twelfth;
  if(language==='english'){
    const label={strong:'strong',weak:'weak',mixed:'mixed'};
    return (same?`On your abroad question, the separate natal strength indicators for houses 9 and 12 are ${label[ninth]}.`:
      `On your abroad question, house 9 has a ${label[ninth]} natal strength indicator; house 12 has a ${label[twelfth]} one.`)+
      '\n\nThese describe the natal chart. They do not establish whether or when a trip will happen or a visa will be approved.';
  }
  if(language==='hindi'){
    const label={strong:'मज़बूत',weak:'कमज़ोर',mixed:'मिले-जुले'};
    return (same?`विदेश के सवाल पर, दी गई जन्मकुंडली में नौवें और बारहवें घर की ताकत के संकेत ${label[ninth]} हैं।`:
      `विदेश के सवाल पर, नौवें घर की ताकत के संकेत ${label[ninth]} और बारहवें घर के संकेत ${label[twelfth]} हैं।`)+
      '\n\nये जन्मकुंडली के संकेत हैं; इनसे सफर होने, उसकी पक्की तारीख या वीज़ा मंज़ूर होने का नतीजा तय नहीं होता।';
  }
  const label={strong:'mazboot',weak:'kamzor',mixed:'mili-juli'};
  return (same?`Videsh ke sawaal par, di gayi janam kundli mein 9ve aur 12ve ghar ki sthiti ${label[ninth]} hai.`:
    `Videsh ke sawaal par, 9ve ghar ki sthiti ${label[ninth]} aur 12ve ghar ki sthiti ${label[twelfth]} hai.`)+
    '\n\nYeh janam kundli ke sanket hain; inse safar hone, uski pakki tareekh ya visa manzoor hone ka nateeja tay nahi hota.';
}
