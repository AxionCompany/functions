import Icon from "../Icon/main.jsx";
import Input from "./Input.jsx";
import { Button } from "../Button/main.js"
const IconInput = ({
    placeholder,
    onClick,
    onChange,
    label,
    icon,
    buttonProps,
    inputProps,
    inputClassName,
    onKeyUp,
    ...props
} = defaultProps) => (
    <div className="form-control">
        <label className="label">
            <span className="label-text">{label}</span>
        </label>
        <div className="input-group">
            <Input
                type="text"
                onChange={onChange}
                placeholder={placeholder}
                onKeyUp={onKeyUp}
                {...props}
                className={`input input-bordered ${inputClassName}`}
                {...inputProps} />
            <Button
                className="btn-outline"
                wide={false}
                onClick={onClick}
                {...buttonProps}>
                <Icon size={"18px"} iconName={icon} />
            </Button>
        </div>
    </div>
)

const defaultProps = {
    placeholder: 'Search...',
    label: 'Label',
    icon: 'HiOutlineSearch',
    buttonProps: {},
    inputProps: {},
}

export default IconInput;

