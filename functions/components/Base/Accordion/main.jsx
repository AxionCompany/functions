export default ({ data }) => {
  const [active, setActive] = React.useState(null);
  return (
    <>
      {data.map((item, index) => {
        return (
          <div
            key={item.id}
            className="collapse collapse-arrow border-b border-base-300 bg-base-200"
          >
            <input
              type="radio"
              name={item.id}
              onChange={() => active !== index ? setActive(index) : setActive(null)}
              checked={active === index ? "checked" : ""}
            />
            <div className="text-md text-left collapse-title font-medium">
              {item.title}
            </div>
            <div className="text-sm text-left collapse-content">
              <p>{item.content}</p>
            </div>
          </div>
        );
      })}
    </>
  );
};
