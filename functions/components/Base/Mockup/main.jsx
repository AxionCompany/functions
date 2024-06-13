export default ({ type, children, url, outerClass }) => {
  type = "browser";
  return (
    <div className={`mockup-browser border border-base-300 ${outerClass}`}>
      <div className="mockup-browser-toolbar items-start">
        <div className="input border border-base-300">{url}</div>
      </div>
      <div className="flex justify-center px-4 py-8 border-t border-base-300">
        {children}
      </div>
    </div>
  );
};
