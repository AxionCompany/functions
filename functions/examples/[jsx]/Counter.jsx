export default (props) => {
  const [count, setCount] = React.useState(0);
  const [inputValue, setInputValue] = React.useState("");
  React.useEffect(() => {
    console.log("effect started");
  }, [count]);

  return (
    <div>
      <p>id: {props["jsx"]}</p>
      <input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      <p>count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Click me</button>
      <p>{inputValue}</p>
    </div>
  );
};
