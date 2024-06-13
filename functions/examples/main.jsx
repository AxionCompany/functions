export default () => "Yeeey!"; // IF a POST, PUT or DELET request is sent, this is the response.

const { Button } = await importAxion(
  "components/Base/Button/main.js",
);

export const GET = () => {
  const [count, setCount] = React.useState(0);
  return (
    <div>
      <h1>Yeeey!</h1>
      <Button onClick={() => setCount(count + 1)}>Click me!</Button>
      <p>GET request received</p>
      <p>Count: {count}</p>
    </div>
  );
}; // If a GET request is sent, this is the response

// you can also use POST, PUT, and DELETE methods by exporting them as well.
