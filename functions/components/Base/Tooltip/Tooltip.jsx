import Icon from "../Icon/main.jsx";
import { Tooltip as ReactTooltip } from "npm:react-tooltip";
import "npm:react-tooltip/dist/react-tooltip.css";

export default function Tooltip({ id, description, iconColor }) {
  return (
    <>
      <ReactTooltip
        anchorSelect={`#${id}`}
        content={`${description}`}
      />
      <div className="max-w-[28px] max-h-7 flex justify-center">
        <a
          className="flex justify-center cursor-pointer"
          id={id}
          data-tooltip-place="top"
        >
          <Icon
            size={"24px"}
            iconName={"HiOutlineInformationCircle"}
            color={iconColor}
          />
        </a>
      </div>
    </>
  );
}
