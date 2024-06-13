import Icon from "../Icon/main.jsx"

const IconLink = ({ label, children, icon, href, type, selected, className, ...props }) => {
    return (
        type === "item"
        ?
            <a
                className={`${selected
                    ? "bg-primary hover:bg-primary-focus text-base-100"
                    : "text-black hover:bg-base-300"
                    } flex flex-row items-center px-4 py-2 rounded-lg`}
                href={href}
            >
                <Icon size={"18px"} iconName={icon} />
                <span className="ml-4 font-medium text-sm">{label}</span>
            </a>
        :
            <a
                className={`${selected
                    ? "bg-secondary hover:bg-secondary-focus text-base-100"
                    : "text-black hover:bg-base-300"
                    } flex flex-row items-center px-4 py-2 rounded-lg`}
                href={href}
            >
                <span className="ml-9 font-light text-xs">{label}</span>
            </a>
    )
};

export default IconLink


