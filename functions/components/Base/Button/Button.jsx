const Button = (
  { children, className, wide, onClick, ...props } = defaultProps,
) => {
  wide = wide === false ? false : true;
  return (
    <button
      onClick={onClick}
      {...props}
      className={`rounded btn w-full${
        wide ? "btn-wide" : ""
      } btn-primary ${className}`}
    >
      {children}
    </button>
  );
};

const defaultProps = {
  children: "TEST",
  className: "", //try "btn-outline" or any other DaisyUI className for the theme
  onClick: () => window.alert("TEST"),
};

export default Button;
