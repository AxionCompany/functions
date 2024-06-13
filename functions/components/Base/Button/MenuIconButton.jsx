import Icon from "../Icon/main.jsx";
import MenuButton from "./MenuButton.jsx";

const MenuIconButton = (
  { label, icon, className, labelClassName, iconColor, iconSize, ...props },
) => {
  return (
    <MenuButton
      className={`items-center ${className}`}
      {...props}
    >
      <Icon
        size={iconSize || "18px"}
        iconName={icon}
        className={`${labelClassName}`}
      />
      <span className={`ml-4 font-light ${labelClassName}`}>{label}</span>
    </MenuButton>
  );
};

export default MenuIconButton;
