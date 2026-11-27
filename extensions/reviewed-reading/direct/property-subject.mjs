import {isPropertyQuestion} from './property-intent.mjs';
import {confirmedFormBirth} from './birth-evidence.mjs';

// A relative's chart must have its own user-authored inputs. Never turn the
// account's selected profile or an assistant's old answer into that evidence.
export function propertyOtherPerson(query) {
 return isPropertyQuestion(query)&&/\b(?:friend|girlfriend|boyfriend|wife|husband|partner|spouse|sister|brother|mother|father|daughter|son|dost|behen|bhai|mummy|papa|uski|uska|unki|unka|his|her|their)\b|उसकी|उसका|उनकी|उनका|दोस्त|पत्नी|पति|बहन|भाई|माँ|पिता|बेटी|बेटा/iu.test(query);
}

export function propertyOtherBirth(query) {
 return propertyOtherPerson(query)?confirmedFormBirth(query):null;
}

export function propertySubjectBoundary(value) {
 if(!propertyOtherPerson(value.query)||propertyOtherBirth(value.query))return null;
 const reply=value.language==='english'?
  'For their property reading, I need their own birth date, exact birth time and birthplace. What are those details?':
  value.language==='hindi'?
  'उनकी संपत्ति की कुंडली देखने के लिए उनकी जन्मतिथि, सही जन्म समय और जन्मस्थान चाहिए। ये विवरण क्या हैं?':
  'Unki property ki kundli dekhne ke liye unki janam tareekh, sahi janam samay aur janam sthan chahiye. Yeh details kya hain?';
 return {kind:'person_profile',supported_event:'property_purchase',reply};
}
