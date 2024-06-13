import Icon from "../Icon/main.jsx";

const PasswordInput = ({
  label,
  iconOn,
  iconOff,
  requiredLabel,
  className,
  ...props
}) => {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <>
      <div className={`form-control w-full ${className}`}>
        <label className="label">
          <span className="label-text">{label}</span>
          {requiredLabel && (
            <span className="text-zinc-400 text-xs">{requiredLabel}</span>
          )}
        </label>
        <div className="flex flex-1">
          <input
            className="input input-bordered w-full"
            type={showPassword ? "text" : "password"}
            {...props}
          />
          <button
            style={{
              backgroundColor: "transparent",
              right: 30,
              width: 0,
              position: "relative",
            }}
            type="button"
            onClick={() => {
              setShowPassword(!showPassword);
            }}
          >
            <Icon
              size={"18px"}
              iconName={showPassword ? iconOn : iconOff}
              color={"#94a3b8"}
            />
          </button>
        </div>
      </div>
    </>
  );
};

export default PasswordInput;
