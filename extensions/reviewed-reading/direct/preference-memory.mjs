// Only a direct request to retain a stated self preference authorizes this
// write. Recall questions, quoted instructions and ordinary chat remain reads.
export function explicitPreferenceMemory(value) {
 if(value.reply_to||typeof value.query!=='string')return null;
 const text=value.query.trim();
 if(text.length>600||/[?？"“”`]/u.test(text)||/\b(?:ignore|system|prompt|password|otp)\b/iu.test(text))return null;
 const match=/^(?:yeh?\s+yaad\s+rakhna|yaad\s+rakhna|please\s+remember|remember\s+(?:this|that)|यह\s+याद\s+रखना|याद\s+रखिए)\s*[:,।-]?\s*(.+)$/iu.exec(text);
 if(!match)return null;
 const fact=match[1].trim();
 if(!/^(?:main|mein|mujhe|mere\s+liye|meri\s+priority|i\s+(?:prefer|value|prioriti[sz]e)|my\s+priority|मैं|मुझे|मेरे\s+लिए|मेरी\s+प्राथमिकता)(?![\p{L}\p{M}])/iu.test(fact))return null;
 if(!/\b(?:prefer\w*|priority|prioriti[sz]\w*|value|pasand|aham|pehle|zaroori)\b|पसंद|प्राथमिकता|अहम|पहले|ज़रूरी|जरूरी/iu.test(fact))return null;
 return '[preference] '+fact;
}
