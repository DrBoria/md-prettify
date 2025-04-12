function isPrime(num: number): boolean {
  if (num < 2) return false;
  for (let i = 2; i <= Math.sqrt(num); i++) {
      if (num % i === 0) {
          return false;
      }
  }
  return true;
}

function findPrimes(limit: number): number[] {
  let primes: number[] = [];
  
  for (let num = 1; num <= limit; num++) {
      if (isPrime(num)) {
          primes.push(num);
      }
  }
  
  return primes;
}

let maxNumber: number = 15;

console.log(`Prime numbers up to ${maxNumber}: ${findPrimes(maxNumber)}`);



