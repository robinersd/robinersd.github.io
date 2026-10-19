// Only complete casual messages trigger the playful script. Short portfolio questions
// and greetings combined with a real question must proceed to an actual answer.
export function isCasualChat(content) {
  if (typeof content !== 'string') return false;
  const q = content
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[?!.,!…]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (
    /^(?:hi+|hello+|hey+|yo|sup|kumusta|kamusta|musta|good morning|good afternoon|good evening|magandang umaga|magandang hapon|magandang gabi)(?: (?:there|again|po|robiner|dahap|bro|lods|idol|assistant|ai))*$/.test(
      q,
    ) ||
    /^(?:single(?: (?:ka|ba|pa|po))*|are you single|is (?:robiner|he) single|taken(?: (?:ka|ba))*|may (?:jowa|gf|girlfriend|boyfriend|bf)(?: (?:ka|ba|po))*|taga saan(?: (?:ka|po|siya|si robiner))*|san ka taga|where are you from|where do you live|where is robiner from)$/.test(
      q,
    ) ||
    /^(?:hindi(?: naman| po| e)?|oo(?: naman| po)?|yes|no|maybe|di ko alam|ewan|haha+|hehe+|lol)$/.test(
      q,
    )
  );
}
