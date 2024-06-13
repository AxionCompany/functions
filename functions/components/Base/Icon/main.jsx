import * as HeroicIcons from "npm:react-icons/hi";
import * as FaIcons from "npm:react-icons/fa";

const Icon = ({ iconName, className, size, color } = defaultProps) => {
  const iconLibVerification = () => {
    if (iconName.slice(0,2) ==="Hi") {
      return HeroicIcons[iconName];
    } else if (iconName.slice(0,2) ==="Fa") {
      return FaIcons[iconName];
    } else {
      return null;
    }
  };
  const icon = iconName ? React.createElement(iconLibVerification()) : null;
  return (
    <div
      className={`items-center ${className}`}
      style={{ fontSize: size, color: color }}
    >
      {icon}
    </div>
  );
};

const defaultProps = {
  iconName: "HiOutlineSearch",
  className: "",
  size: "18px",
  color: "#000",
};

export default Icon;
