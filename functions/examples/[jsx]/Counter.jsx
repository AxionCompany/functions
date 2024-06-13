const { useState, useEffect } = React;

export default (props) => {
  const [count, setCount] = useState(0);
  const [inputValue, setInputValue] = useState("");
  useEffect(() => {
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
