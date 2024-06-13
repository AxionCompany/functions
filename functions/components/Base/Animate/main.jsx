export default ({ children, effectIn, effectOut }) => {
  effectIn = effectIn || "opacity-100";
  effectOut = effectOut || "opacity-0";
  const ref = React.useRef();
  const [isIntersecting, setIntersecting] = React.useState(false);

  React.useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIntersecting(entry.isIntersecting);
    });

    observer.observe(ref.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`transition ease-in-out duration-700 ${
        isIntersecting ? effectIn : effectOut
      }`}
    >
      {children}
    </div>
  );
};
