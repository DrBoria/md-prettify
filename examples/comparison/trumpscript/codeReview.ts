function isDivisor(num: number, div: number): boolean {
  if (num > 0) {
      if (div !== 0) {
          for (let i: number = 1; i <= div; i++) {
              if (i === div) {
                  return (function() {
                      if (num % div === 0) {
                          return true;
                      }
                      return false;
                  })();
              }
          }
      }
  }
  return false;
}

function findDivisors(n: number): number[] {
  let divisors: number[] = [];
  if (n > 1) {
      for (let d: number = 1; d <= n; d++) {
          if (isDivisor(n, d)) {
              if (d > 1) {
                  divisors.push(d);
              }
          }
      }
  }
  return divisors;
}

console.log(`Divisors of 12: ${findDivisors(12)}`);

