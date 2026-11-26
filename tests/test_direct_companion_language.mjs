import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCompanionLanguage} from '../extensions/reviewed-reading/direct/companion-language.mjs';
const value={language:'hinglish'};
test('companion presentation preserves quotations, code, URLs, facts and self grammar',()=>{
 const protectedParts=['"tumhari baat keh do"','“practice karo”',"'kar lo'",'`karo`','```\ntum\n```','https://example.test/karo'];
 const original=protectedParts.join(' ')+' Main sun raha hoon. Main karungi. Rohan ka interview 28 November 2026 ko hai. Aap ho sakte hain.';
 assert.equal(normalizeCompanionLanguage(original,value),original);
 assert.equal(normalizeCompanionLanguage('Tumne kaha, practice karo.',{language:'english'}),'Tumne kaha, practice karo.');
 assert.equal(normalizeCompanionLanguage("I'm here; aap keh do.",value),"I'm here; aap keh dijiye.");
});
