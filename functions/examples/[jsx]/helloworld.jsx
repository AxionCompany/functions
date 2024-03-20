export default (props) => {
  const [count, setCount] = React.useState(0);
  return (
    <div>
      <h1 className={`text-3xl text-${props["jsx"]}-800`}>
        Hello World
      </h1>
      <p>id: {props["jsx"]}</p>
    </div>
  );
};
