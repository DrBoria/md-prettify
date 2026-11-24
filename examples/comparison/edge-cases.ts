const value = 1;
export { value };
export default value;
const config = { a: 1, b: [2, 3], c: { d: 4 } };
const double = (n: number): number => n * 2;
function run(): void {
	if (value > 0) {
		console.log('yes');
	} else {
		console.log('no');
	}
	for (let i = 0; i < 3; i++) {
		run();
	}
}
export function Counter(): JSX.Element {
	const [count, setCount] = useState(0);
	return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
const Box = styled.div`
	color: red;
`;
  