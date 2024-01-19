
export default async (props) => {
  const [count, setCount] = React.useState(0);
  const [inputValue, setInputValue] = React.useState("");
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await sleep(1000);
  React.useEffect(() => {
    console.log('effect started');
  }, [count])

  return (
    <div>
      <h1 className={`text-3xl text-${props["jsx-example"]}-800`}>Hello World</h1>
      <p>id: {props["jsx-example"]}</p>
      <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
      <p>count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Click me</button>
      <p>{inputValue}</p>
    </div>
  );
};
