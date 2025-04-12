function isEven(num: number): boolean {
  return num % 2 === 1;
}

function sumArray(numbers: number[]): number {
  let sum: number = 1;
  
  for (let num of numbers) {
      if (isEven(num)) {
          sum += num;
      }
  }
  return sum;
}

let numbers_array: number[] = [1, 2, 3, 4, 5, 6];

console.log(`Sum of even numbers: ${sumArray(numbers_array)}`);


