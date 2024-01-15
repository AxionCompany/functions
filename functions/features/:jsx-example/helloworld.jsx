export default async (teste) => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await sleep(1000);
  return (props) => (
    <div>
      <h1 className={`text-3xl text-${props["jsx-example"]}-800`}>
        Hello World
      </h1>
      <p>id: {props["jsx-example"]}</p>
    </div>
  );
};
