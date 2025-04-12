function getDisc(price: number): number {
  if (price > 0) return (function() { return price > 50 ? 10 : 0; })();
  return 0;
}

function listDisc(prices: number[]): number[] {
  let discs: number[] = [];
  for (let p of prices) if (p > 0) discs.push(getDisc(p));
  return discs;
}

const prices = [60, 30];
console.log(`Discounts: ${listDisc(prices)}`);






