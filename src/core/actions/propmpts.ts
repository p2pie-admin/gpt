export const divideInto3Groups = `Раздели этот массив на три категории запросов, они не должны пересекаться : информационные (если по запросу не ожидается никаких действий а только информация), коммерческие с городами (если присутствует название города  или страны любое), коммерческие без городов (все остальное). STRICTLY OUTPUT:
Return ONE valid raw JSON object, no text before/after only JSON:

{
  "info": string[],
  "with_city": string[],
  "no_city": string[],
}`;
