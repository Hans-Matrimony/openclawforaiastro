import {savedBirthContext} from './context.mjs';
import {pilotBirthClarification} from './pilot-response-boundaries.mjs';

export function partialBirthCollectionReply(value) {
  const profile=savedBirthContext(value.birth);
  if(profile.status!=='PARTIAL'||value.reply_to)return null;
  const text=String(value.query??'').trim();
  if(((text.length>240||/[?？]/u.test(text))&&value.profile_update_status!=='saved')||
    /\b(?:friend|brother|sister|mother|father|wife|husband|partner|girlfriend|boyfriend|dost|bhai|behen)\b|भाई|बहन|पत्नी|पति|दोस्त/iu.test(text))return null;
  if(value.profile_update_status!=='saved'&&!/^(?:meri\s+(?:date\s+of\s+birth|janam\s+tithi)|mera\s+(?:janam|janm)|my\s+(?:date\s+of\s+birth|birth\s*time|birthplace)|dob\s*[:=]|मेरी\s+जन्म\s*तिथि|मेरा\s+जन्म)/iu.test(text))return null;
  // These are authoritative selected-profile fields. Asking for the missing
  // inputs is not a prediction and must not require chart evidence or a retry.
  return pilotBirthClarification('Please share birth details',profile,value.language,[]);
}
