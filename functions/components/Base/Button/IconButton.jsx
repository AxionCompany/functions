import Icon from "../Icon/main.jsx";

const IconButton = (
  { icon, className, iconClassName, iconColor, iconSize, ...props },
) => {
  return (
    <button
      className={`btn items-center ${className || "btn-square"}`}
      {...props}
    >
      <Icon
        size={iconSize || "18px"}
        iconName={icon}
        className={`${iconClassName}`}
      />
    </button>
  );
};

export default IconButton;
