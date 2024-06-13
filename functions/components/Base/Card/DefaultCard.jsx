export default ({ component, title, content, outerClassName }) => {
  return (
    <div
      className={`flex items-start justify-start w-full relative overflow-hidden  border-transparent rounded-lg bg-base-100 p-2 ${outerClassName}`}
    >
      <div className="flex max-h-[250px] flex-col justify-between rounded-md p-5 text-primary">
        {component}
        {(title || content) && (
          <div className="space-y-2">
            <h3 className="flex font-bold ">{title}</h3>
            <p className="text-sm text-left text-base-content">
              {content}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
