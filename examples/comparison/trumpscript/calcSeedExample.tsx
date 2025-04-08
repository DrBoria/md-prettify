function calcSeedCost(base: number, qty: number, discount: boolean): number {
  let cost = 0;
  let seeds = qty;
  let isBulk = qty > 3;
  let isValid = base !== 0;
  while (seeds > 0 && isValid) {
      let price = base;
      if (discount === true && isBulk) {
          price = price - 2;
      }
      cost = cost + price;
      console.log(`Cost for ${seeds} seeds: ${cost}`);
      seeds = seeds - 1;
  }
  if (cost == 0) console.log(`No cost!`);
  return cost;
}

let price = 6;
let amount = 5;
let hasDiscount = true;
let isPremium = false;
let isCheap = price < 8;
let total = calcSeedCost(price, amount, hasDiscount);
console.log(`Total cost: ${total}`);

while (total > 10 && !isCheap) {
  total = total / 2;
  console.log(`Reduced cost: ${total}`);
}

let checkCount = 0;
while (checkCount < 3) {
  console.log(`Check #${checkCount + 1}: Cost at ${total}`);
  checkCount = checkCount + 1;
}

let isTwenty = total == 20;
let notTen = total !== 10;
let overFive = total > 5;
console.log(`Is 20? ${isTwenty} | Not 10? ${notTen} | Over 5? ${overFive}`);
if (!isPremium && total * 4 === 40) {
  total = total + 10;
  console.log(`Final adjusted: ${total}`);
}
